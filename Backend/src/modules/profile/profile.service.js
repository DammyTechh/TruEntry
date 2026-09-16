'use strict';

const { query, queryOne } = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const ninService = require('../../services/nin.service');
const regulatorService = require('../../services/regulator.service');
const storageService = require('../../services/storage.service');

function shape(user, profile) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    role: user.role,
    profile: profile
      ? {
          entryMode: profile.entry_mode,
          nin: profile.nin ? maskNin(profile.nin) : null,
          ninVerified: profile.nin_verified,
          jambRegNo: profile.jamb_reg_no,
          jambVerified: profile.jamb_verified,
          jambScore: profile.jamb_data ? profile.jamb_data.jambScore : null,
          olevelExamType: profile.olevel_exam_type,
          olevelRegNo: profile.olevel_reg_no,
          olevelVerified: profile.olevel_verified,
          olevelResults: profile.olevel_data ? profile.olevel_data.results : null,
          dateOfBirth: profile.date_of_birth,
          gender: profile.gender,
          stateOfOrigin: profile.state_of_origin,
          lga: profile.lga,
          address: profile.address,
          location: profile.location,
          profileImageUrl: profile.profile_image_url,
        }
      : null,
  };
}

function maskNin(nin) {
  return `${nin.slice(0, 3)}****${nin.slice(-2)}`;
}

async function loadProfileRow(userId) {
  return queryOne('SELECT * FROM applicant_profiles WHERE user_id = $1', [userId]);
}

async function getProfile(userId) {
  const user = await queryOne('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) throw ApiError.notFound('User not found');
  let profile = await loadProfileRow(userId);
  if (!profile) {
    profile = await queryOne(
      'INSERT INTO applicant_profiles (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
  }
  return shape(user, profile);
}

async function updateProfile(userId, body) {
  await loadProfileRow(userId); // ensure exists
  const map = {
    entryMode: 'entry_mode',
    // NIN is RECORDED here during onboarding; it is only marked verified by
    // /profile/verify-nin, which calls Dojah. Recording it never sets the
    // verified flag, so onboarding can complete without incurring a charge.
    nin: 'nin',
    jambRegNo: 'jamb_reg_no',
    olevelExamType: 'olevel_exam_type',
    olevelRegNo: 'olevel_reg_no',
    dateOfBirth: 'date_of_birth',
    gender: 'gender',
    stateOfOrigin: 'state_of_origin',
    lga: 'lga',
    address: 'address',
    location: 'location',
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      values.push(body[key]);
    }
  }
  if (!sets.length) return getProfile(userId);
  values.push(userId);
  await query(
    `UPDATE applicant_profiles SET ${sets.join(', ')} WHERE user_id = $${i}`,
    values
  );
  return getProfile(userId);
}

/**
 * Verify NIN via Dojah (or mock) and persist the result.
 */
async function verifyNin(userId, nin) {
  const existing = await queryOne(
    'SELECT id FROM applicant_profiles WHERE nin = $1 AND user_id <> $2',
    [nin, userId]
  );
  if (existing) throw ApiError.conflict('This NIN is already linked to another account', { code: 'NIN_IN_USE' });

  const data = await ninService.validateNin(nin);
  await query(
    `UPDATE applicant_profiles
       SET nin = $1, nin_verified = TRUE, nin_data = $2,
           date_of_birth = COALESCE(date_of_birth, $3),
           gender = COALESCE(gender, $4),
           state_of_origin = COALESCE(state_of_origin, $5)
     WHERE user_id = $6`,
    [
      nin,
      JSON.stringify(data),
      data.dateOfBirth || null,
      data.gender ? data.gender.toLowerCase() : null,
      data.stateOfOrigin || null,
      userId,
    ]
  );
  return { verified: true, data: { ...data, nin: maskNin(nin) } };
}

/**
 * Verify JAMB registration (stub/live) and persist score + biodata.
 */
async function verifyJamb(userId, jambRegNo) {
  const data = await regulatorService.verifyJamb(jambRegNo);
  await query(
    `UPDATE applicant_profiles
       SET jamb_reg_no = $1, jamb_verified = TRUE, jamb_data = $2,
           date_of_birth = COALESCE(date_of_birth, $3),
           gender = COALESCE(gender, $4),
           state_of_origin = COALESCE(state_of_origin, $5)
     WHERE user_id = $6`,
    [
      jambRegNo,
      JSON.stringify(data),
      data.dateOfBirth || null,
      data.gender ? String(data.gender).toLowerCase() : null,
      data.stateOfOrigin || null,
      userId,
    ]
  );
  return { verified: true, data };
}

/**
 * Verify O-Level (WAEC/NECO/NABTEB) and persist results.
 */
async function verifyOlevel(userId, examType, regNo) {
  const data = await regulatorService.verifyOlevel(examType, regNo);
  const credits = regulatorService.countCredits(data.results);
  await query(
    `UPDATE applicant_profiles
       SET olevel_exam_type = $1, olevel_reg_no = $2, olevel_verified = TRUE, olevel_data = $3
     WHERE user_id = $4`,
    [examType, regNo, JSON.stringify({ ...data, credits }), userId]
  );
  return { verified: true, credits, data };
}

/**
 * Upload profile image to Supabase and store URL.
 */
async function uploadImage(userId, file) {
  if (!file) throw ApiError.badRequest('No image uploaded', { code: 'NO_FILE' });
  const { url } = await storageService.upload({
    bucket: storageService.buckets.profiles,
    buffer: file.buffer,
    contentType: file.mimetype,
    folder: userId,
  });
  await query('UPDATE applicant_profiles SET profile_image_url = $1 WHERE user_id = $2', [url, userId]);
  return { profileImageUrl: url };
}

/**
 * Compute onboarding completion so the frontend can gate application.
 */
async function completion(userId) {
  const p = await loadProfileRow(userId);

  const checks = {
    ninVerified: !!p?.nin_verified,
    jambVerified: !!p?.jamb_verified,
    olevelVerified: !!p?.olevel_verified,
    hasImage: !!p?.profile_image_url,
    hasBiodata: !!(p?.date_of_birth && p?.gender && p?.state_of_origin && p?.lga),
    hasLocation: !!p?.location,
    hasNin: !!p?.nin,
    hasJambRegNo: !!p?.jamb_reg_no,
    hasOlevelRecord: !!p?.olevel_reg_no,
  };

  // ---------------------------------------------------------------------
  // Onboarding contract (authoritative for the client).
  //
  // Onboarding captures RECORDS only. Credential verification costs money, so
  // it happens after the application fee is paid — during the application
  // flow, not here. Onboarding is therefore complete once the applicant has
  // supplied their biodata/photo/NIN and their exam registration details.
  // ---------------------------------------------------------------------
  const biodataComplete = checks.hasBiodata && checks.hasLocation && checks.hasImage && checks.hasNin;
  const examDetailsComplete = checks.hasJambRegNo && checks.hasOlevelRecord;
  const onboardingComplete = biodataComplete && examDetailsComplete;

  const steps = {
    biodata: { complete: biodataComplete, order: 1 },
    examDetails: { complete: examDetailsComplete, order: 2 },
  };

  const currentStep = !biodataComplete ? 1 : !examDetailsComplete ? 2 : null;

  const done = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;

  return {
    checks,
    steps,
    currentStep,
    onboardingComplete,
    percentage: Math.round((done / total) * 100),
    // Legacy field: "everything including verification is done".
    complete: onboardingComplete,
    // An applicant may start an application once onboarding records exist.
    // Verification happens after payment, inside the application flow.
    canApply: onboardingComplete,
    verification: {
      nin: !!p?.nin_verified,
      jamb: !!p?.jamb_verified,
      olevel: !!p?.olevel_verified,
    },
  };
}


module.exports = {
  getProfile,
  updateProfile,
  verifyNin,
  verifyJamb,
  verifyOlevel,
  uploadImage,
  completion,
  loadProfileRow,
};
