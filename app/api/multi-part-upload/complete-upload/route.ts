import { S3Client, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextResponse, NextRequest } from "next/server";

const s3 = new S3Client({ region: "us-east-2" })

export async function POST(req) {
    const { objectKey, uploadId, uploadedParts } = await req.json();
    const command = new CompleteMultipartUploadCommand({
        Bucket: "blackbird-documentary-footage",
        Key: objectKey,
        UploadId: uploadId,
        MultipartUpload: {
            Parts: uploadedParts
        }
    });
    const body = await s3.send(command);
    return NextResponse.json(
        { response: body },
        { status: 200 }
    );
}