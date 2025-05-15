import { createUser } from "@/actions/user";
import { deleteUser } from "@/actions/user";
import { message } from "antd";
import { headers } from "next/headers";
import { Webhook } from "svix";

export async function POST(req) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
        throw new Error("Please add webhook secret from clerk dashboard to .env or .env.local file");
    }
    //get headers from request
    const headerPayload = headers();
    const svix_id = (await headerPayload).get("svix-id");
    const svix_signature = (await headerPayload).get("svix-signature");
    const svix_timestamp = (await headerPayload).get("svix-timestamp");

    //if there is no headers , error out 
    if (!svix_id || !svix_signature || !svix_timestamp) {
        return new Response("Missing headers", { status: 400 });
    }

    //get the raw body from request
    const payload = await req.json();
    if (!payload || typeof payload !== "object") {
        console.error("Invalid payload:", payload);
        return new Response("Invalid payload received", { status: 400 });
    }

    const body = JSON.stringify(payload);
    console.log("Webhook body:", body);
    console.log("Headers:", {
        "svix-id": svix_id,
        "svix-signature": svix_signature,
        "svix-timestamp": svix_timestamp,
    });

    //create a new svix instance 
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt;

    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-signature": svix_signature,
            "svix-timestamp": svix_timestamp,
        });
    } catch (e) {
        console.error("error verifying the webhook");
        return new Response("error verifying the webhook", { status: 400 });
    }

    const eventType = evt.type;
    console.log("Event type: ", eventType);

    if (eventType === "user.created") {
        const { id, first_name, last_name, email_addresses, image_url, username } = evt.data;
        console.log(evt.data);
        // Handle missing or invalid email_addresses
        const email_address =
            Array.isArray(email_addresses) && email_addresses.length > 0
                ? email_addresses[0]?.email_address
                : null;

        if (!email_address) {
            console.error("Email address is missing or invalid.");
            return new Response("Invalid email address", { status: 400 });
        }
        try {
            await createUser({ id, first_name, last_name, email_address, image_url, username });
        } catch (e) {
            return new Response("Error creating user in db");
        }
    }

    if (eventType === "user.deleted") {
        const { id } = evt.data;
        console.log("Deleting user with ID:", id);
        try {
            await deleteUser(id);
        } catch (e) {
            return new Response("Error deleting user from db", { status: 500 });
        }
    }

    return Response.json({ message: "received event type: " + eventType });
}

// export async function GET(){
//     return Response.json({message: "Hello World!"})
// }
