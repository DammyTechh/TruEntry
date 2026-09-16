import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import { ROLES } from './lib/constants';

import PublicLayout from './components/layout/PublicLayout';
import DashboardShell from './components/layout/DashboardShell';
import { OnboardingProvider } from './context/OnboardingContext';
import { ApplicantDashboardGate, OnboardingEntry, OnboardingStepGate } from './components/onboarding/OnboardingGuards';

// Public
import Landing from './pages/public/Landing';
import Institutions from './pages/public/Institutions';
import InstitutionDetail from './pages/public/InstitutionDetail';
import HowItWorks from './pages/public/HowItWorks';
import FAQ from './pages/public/FAQ';
import NotFound from './pages/public/NotFound';

// Auth
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ChangePassword from './pages/auth/ChangePassword';

// Onboarding
import BiodataStep from './pages/onboarding/Biodata';
import ExamDetailsStep from './pages/onboarding/ExamDetails';

// Applicant
import AppDashboard from './pages/applicant/Dashboard';
import Profile from './pages/applicant/Profile';
import Apply from './pages/applicant/Apply';
import Applications from './pages/applicant/Applications';
import ApplicationDetail from './pages/applicant/ApplicationDetail';
import Payments from './pages/applicant/Payments';
import PaymentCallback from './pages/applicant/PaymentCallback';

// Institution (officer/registrar)
import InstDashboard from './pages/institution/Dashboard';
import InstApplications from './pages/institution/Applications';
import InstApplicationDetail from './pages/institution/ApplicationDetail';
import Decisioning from './pages/institution/Decisioning';
import Quotas from './pages/institution/Quotas';
import InstSettings from './pages/institution/Settings';
import Admissions, { AdmissionDetail } from './pages/institution/Admissions';
import QuotaBuilder from './pages/institution/QuotaBuilder';
import Departments from './pages/institution/Departments';
import InstReports from './pages/institution/Reports';
import Approvals from './pages/institution/Approvals';

// JAMB
import JambDashboard from './pages/jamb/Dashboard';
import JambApplicants from './pages/jamb/Applicants';
import JambForwarded from './pages/jamb/Forwarded';
import JambAdmitted from './pages/jamb/Admitted';

// Admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminInstitutions from './pages/admin/Institutions';
import AdminFeeSettings from './pages/admin/FeeSettings';
import AdminJambAudit from './pages/admin/JambAudit';
import AdminFinances from './pages/admin/Finances';
import AdminAudit from './pages/admin/Audit';
import AdminMock from './pages/admin/Mock';

const staff = [ROLES.OFFICER, ROLES.REGISTRAR, ROLES.INSTITUTION];

function ApplicantOnboardingBoundary() {
  return (
    <ProtectedRoute allow={[ROLES.APPLICANT]}>
      <OnboardingProvider>
        <Outlet />
      </OnboardingProvider>
    </ProtectedRoute>
  );
}

function ApplicantAppShell() {
  return (
    <ProtectedRoute allow={[ROLES.APPLICANT]}>
      <OnboardingProvider>
        <ApplicantDashboardGate>
          <DashboardShell />
        </ApplicantDashboardGate>
      </OnboardingProvider>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/institutions" element={<Institutions />} />
        <Route path="/institutions/:id" element={<InstitutionDetail />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/faq" element={<FAQ />} />
      </Route>

      {/* Paystack returns here (see backend PAYSTACK_CALLBACK_URL: /payment/callback) */}
      <Route
        path="/payment/callback"
        element={
          <ProtectedRoute allow={[ROLES.APPLICANT]}>
            <PaymentCallback />
          </ProtectedRoute>
        }
      />

      {/* Auth */}
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
      <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />

      {/* Mandatory password change (system-generated credentials) */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Applicant onboarding */}
      <Route path="/onboarding" element={<ApplicantOnboardingBoundary />}>
        <Route index element={<OnboardingEntry />} />
        <Route
          path="biodata"
          element={
            <OnboardingStepGate step={1}>
              <BiodataStep />
            </OnboardingStepGate>
          }
        />
        <Route
          path="exam-details"
          element={
            <OnboardingStepGate step={2}>
              <ExamDetailsStep />
            </OnboardingStepGate>
          }
        />
        {/* Payment moved to the application flow (fees are charged per
            application, and verification happens after payment). Kept as a
            redirect so old links/bookmarks never dead-end. */}
        <Route path="payment" element={<Navigate to="/app" replace />} />
      </Route>

      {/* Applicant portal: reachable once onboarding records are captured. */}
      <Route path="/app" element={<ApplicantAppShell />}>
        <Route index element={<AppDashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="apply" element={<Apply />} />
        <Route path="applications" element={<Applications />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
        <Route path="payments" element={<Payments />} />
      </Route>

      {/* Institution */}
      <Route
        path="/institution"
        element={
          <ProtectedRoute allow={staff}>
            <DashboardShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<InstDashboard />} />
        <Route path="applications" element={<InstApplications />} />
        <Route path="applications/:id" element={<InstApplicationDetail />} />
        <Route path="decisioning" element={<Decisioning />} />
        <Route path="quotas" element={<Quotas />} />
        <Route path="quotas/new" element={<QuotaBuilder />} />
        <Route path="quotas/:id" element={<QuotaBuilder />} />
        <Route path="admissions" element={<Admissions />} />
        <Route path="admissions/:id" element={<AdmissionDetail />} />
        <Route path="settings" element={<InstSettings />} />
        <Route path="departments" element={<Departments />} />
        <Route path="reports" element={<InstReports />} />
        <Route path="approvals" element={<Approvals />} />
      </Route>

      {/* JAMB */}
      <Route
        path="/jamb"
        element={
          <ProtectedRoute allow={[ROLES.JAMB]}>
            <DashboardShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<JambDashboard />} />
        <Route path="applicants" element={<JambApplicants />} />
        <Route path="forwarded" element={<JambForwarded />} />
        <Route path="admitted" element={<JambAdmitted />} />
      </Route>

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allow={[ROLES.ADMIN]}>
            <DashboardShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="institutions" element={<AdminInstitutions />} />
        <Route path="finances" element={<AdminFinances />} />
        <Route path="fee-settings" element={<AdminFeeSettings />} />
        <Route path="jamb-audit" element={<AdminJambAudit />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="mock" element={<AdminMock />} />
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
