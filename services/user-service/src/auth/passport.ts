import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { Role } from '@prisma/client';
import { prisma } from '../prisma';

async function verifyGoogleProfile(
  _accessToken: string,
  _refreshToken: string,
  profile: Profile,
  done: VerifyCallback,
) {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('Google profile did not include an email address'));
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: profile.id }, { email }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: profile.id,
          email,
          name: profile.displayName,
          role: Role.CUSTOMER,
        },
      });
    } else if (!user.googleId) {
      // Existing email/password account signing in with Google for the first time.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.id },
      });
    }

    return done(null, user);
  } catch (err) {
    return done(err as Error);
  }
}

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL = process.env.GOOGLE_CALLBACK_URL;

// passport-google-oauth20 throws synchronously if clientID/clientSecret are
// missing, so only register the strategy once real credentials are set.
// Until then, /auth/google will fail with "Unknown authentication strategy"
// instead of crashing the whole service on startup/import.
if (clientID && clientSecret && callbackURL) {
  passport.use(new GoogleStrategy({ clientID, clientSecret, callbackURL }, verifyGoogleProfile));
} else {
  console.warn(
    'Google OAuth is not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_CALLBACK_URL) — /auth/google and /auth/google/callback will be unavailable until these are set.',
  );
}

export default passport;
