import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

const prisma = new PrismaClient();

async function testConnection() {
    try {
        await prisma.$connect();
        console.log("Database connected successfully");
    } catch (error) {
        console.error("Failed to connect to database:", error.message);
    } 
    finally {
        await prisma.$disconnect();
    }
}

testConnection();
export const db = globalForPrisma.prisma || new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
