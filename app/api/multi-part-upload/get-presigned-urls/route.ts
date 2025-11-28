import { NextRequest, NextResponse } from "next/server";   
import { S3Client, UploadPartCommand } from "@aws-sdk/client-s3"; 
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: "us-east-2" })


export async function POST(req) {
    try {
        const { objectKey, uploadId, numParts } = await req.json();
        if (!objectKey || !uploadId || !numParts) {
            console.log(objectKey, uploadId, numParts);
            return NextResponse.json(
                { error: "Didn't have objectKey, uploadId, or numParts"},
                { status: 500 }
            )
        }
        const partNumbers = Array.from(
            {length: numParts},
            (_, i) => i+1
        )
        const presignedUrlPromises = partNumbers.map(async partNumber => {
            const command = new UploadPartCommand({
                Bucket: "blackbird-documentary-footage",
                Key: objectKey,
                UploadId: uploadId,
                PartNumber: partNumber
            })
            const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 30 }) // 30 min
            return { partNumber, signedUrl }
        })
        const presignedUrls = await Promise.all(presignedUrlPromises);
        return NextResponse.json(
            {
                uploadId,
                objectKey,
                presignedUrls
            },
            { status: 200 }
        )
    } catch (err) {
        console.log("Server error:", err)
        return NextResponse.json(
            { error: "Server error, couldn't get urls."},
            { status: 500 }
        )
    }
}