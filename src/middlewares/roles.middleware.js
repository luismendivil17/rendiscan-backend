export const requireRole = (...need) => {
  const allowed = need
    .flatMap(r => Array.isArray(r) ? r : [r])
    .filter(Boolean)
    .map(r => String(r).trim().toLowerCase());

  return (req, res, next) => {
    const got = String(req.user?.rol ?? '').trim().toLowerCase();
    if (!allowed.includes(got)) {
      return res.status(403).json({
        error: 'Require rol',
        need: allowed,
        got,
        user: req.user?.id,
      });
    }
    next();
  };
};
