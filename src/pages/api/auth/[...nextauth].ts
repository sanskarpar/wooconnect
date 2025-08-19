import NextAuth, { Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";
import { compare } from "bcryptjs";

// Extend the Session type to include user.id
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const client = await clientPromise;
          const users = client.db("wooconnect").collection("users");
          const user = await users.findOne({ email: credentials?.email });

          if (!user) {
            console.log("User not found for email:", credentials?.email);
            return null;
          }

          if (!user.hashedPassword) {
            console.log("User found but no hashedPassword field:", user);
            return null;
          }

          const isValid = await compare(credentials!.password, user.hashedPassword);
          if (!isValid) {
            console.log("Password does not match for user:", user.email);
            return null;
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        token.sub = user.id;
      }
      
      // Store Google Drive tokens for later use
      if (account && account.provider === "google") {
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        token.googleTokenExpiry = account.expires_at;
        
        // Store tokens in database for Google Drive service
        if (token.sub) {
          try {
            const client = await clientPromise;
            const db = client.db('wooconnect');
            const googleDriveConfigCollection = db.collection('googleDriveConfig');
            
            await googleDriveConfigCollection.updateOne(
              { userId: token.sub },
              { 
                $set: {
                  userId: token.sub,
                  accessToken: account.access_token,
                  refreshToken: account.refresh_token,
                  tokenExpiryDate: account.expires_at ? account.expires_at * 1000 : null, // Convert to milliseconds
                  connectedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              },
              { upsert: true }
            );
          } catch (error) {
            console.error('Error storing Google Drive tokens:', error);
          }
        }
      }
      
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.sub;
        // Don't expose tokens to client-side session
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
};

export { authOptions };
export default NextAuth(authOptions);
