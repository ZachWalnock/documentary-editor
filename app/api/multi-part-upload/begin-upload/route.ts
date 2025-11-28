import { S3Client, CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextResponse, NextRequest } from "next/server";

const s3 = new S3Client({ region: "us-east-2" })

export async function POST(req) {
    try {
        const { fileName, contentType } = await req.json();
        //TODO add uuid to make object names more unique
        const objectKey = `${fileName}-${Date.now().toString()}`
        const command = new CreateMultipartUploadCommand({
            Bucket: "blackbird-documentary-footage",
            Key: objectKey,
            ContentType: contentType
        });
        const response = await s3.send(command);
        console.log("response.UploadId")
        console.log(response.UploadId)
        return NextResponse.json({
            uploadId: response.UploadId,
            objectKey
        }, {status: 200});
    } catch (err) {
        console.log("Error: " + err)
        return NextResponse.json(
            {status: 500}
        )
    }
}