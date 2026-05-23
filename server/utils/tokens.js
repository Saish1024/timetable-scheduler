const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_EXPIRY = "8h";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_GRACE_SECONDS = 60 * 60; // 1 hour after access token expiry

const getRefreshSecret = () =>
  process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}_refresh`;

const buildPayload = (user) => ({
  id: user._id.toString(),
  name: user.name,
  role: user.role,
  department:
    user.department?._id?.toString() || user.department?.toString() || null,
});

const signAccessToken = (user) =>
  jwt.sign(buildPayload(user), process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

const signRefreshToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), type: "refresh" },
    getRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/api/auth",
  });
};

/**
 * Access token may be valid or expired by at most REFRESH_GRACE_SECONDS.
 */
const isAccessTokenWithinRefreshGrace = (accessToken) => {
  const decoded = jwt.decode(accessToken);
  if (!decoded?.exp || !decoded?.id) {
    return { ok: false, reason: "Invalid access token" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp >= now) {
    return { ok: true, decoded };
  }

  const secondsSinceExpiry = now - decoded.exp;
  if (secondsSinceExpiry > REFRESH_GRACE_SECONDS) {
    return {
      ok: false,
      reason: "Session expired, please log in again",
    };
  }

  return { ok: true, decoded };
};

module.exports = {
  ACCESS_TOKEN_EXPIRY,
  signAccessToken,
  signRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshSecret,
  isAccessTokenWithinRefreshGrace,
};
