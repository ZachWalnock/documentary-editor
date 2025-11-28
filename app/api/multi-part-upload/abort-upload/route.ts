import { S3Client, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextResponse, NextRequest } from "next/server";

const s3 = new S3Client({ region: "us-east-2" })

export async function DELETE(req) {
    try {
        const { objectKey, uploadId } = await req.json();
        const command = new AbortMultipartUploadCommand({
            Bucket: "blackbird-documentary-footage",
            Key: objectKey,
            UploadId: uploadId
        });
        const response = await s3.send(command);
        console.log("Abort status:")
        console.log(response)
        return NextResponse.json(
            { success: "Multipart upload successfully aborted."}, 
            {status: 200});
    } catch (err) {
        console.log("Error: " + err)
        return NextResponse.json(
            {status: 500}
        )
    }
}