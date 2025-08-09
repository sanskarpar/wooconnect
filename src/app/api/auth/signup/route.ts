"use client";
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { hash } from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // Parse body safely
    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("Failed to parse JSON body:", parseErr);
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }
    const { name, email, password } = body;
    if (!name || !email || !password) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("wooconnect"); // Explicitly specify your database name
    // Check if users collection exists, create if not
    const collections = await db.listCollections({ name: "users" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("users");
    }
    const users = db.collection("users");

    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json({ message: "User already exists" }, { status: 409 });
    }

    const hashedPassword = await hash(password, 10);
    await users.insertOne({ name, email, hashedPassword });

    return NextResponse.json({ message: "User created" }, { status: 201 });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
