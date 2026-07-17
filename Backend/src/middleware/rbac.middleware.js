'use strict';

const ApiError = require('../utils/ApiError');
const { ROLES } = require('../utils/constants');

/**
 * Allow only the given roles.
 * @param  {...string} roles
 * @example router.get('/', authenticate, authorize(ROLES.ADMIN), handler)
 */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden('You do not have the required role for this action', {
          code: 'INSUFFICIENT_ROLE',
        })
      );
    }
    next();
  };
}

/**
 * Ensure the authenticated institution user is acting within their own institution.
 * Reads the target institution id from params/body/query under common keys.
 */
function sameInstitution(paramKey = 'institutionId') {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    // Admin and JAMB are cross-institution by design.
    if ([ROLES.ADMIN, ROLES.JAMB].includes(req.user.role)) return next();

    const target =
      req.params[paramKey] ||
      req.params.institution_id ||
      req.body.institutionId ||
      req.body.institution_id ||
      req.query.institutionId;

    if (!target) return next(); // resolved later by the controller against req.user.institutionId
    if (String(target) !== String(req.user.institutionId)) {
      return next(
        ApiError.forbidden('You can only access resources within your institution', {
          code: 'CROSS_INSTITUTION_FORBIDDEN',
        })
      );
    }
    next();
  };
}

module.exports = { authorize, sameInstitution };
