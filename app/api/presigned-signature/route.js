export async function POST(request) {
    try {
        const { file_extension, file_name } = await request.json();
        
        if (!file_extension) {
            return Response.json(
                { error: 'File extension is required' },
                { status: 400 }
            );
        }
        console.log("File extension:" + file_extension)
        const json = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ file_extension }),
        }
        const presigned_response = await fetch("https://lmqsjkzbx0.execute-api.us-east-2.amazonaws.com/default/createPutSignature", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ file_extension, file_name }),
        });
        
        if (!presigned_response.ok) {
            return Response.json(
                { error: 'Failed to get presigned URL' },
                { status: presigned_response.status }
            );
        }
        
        const data = await presigned_response.json();
        return Response.json(data);
    } catch (error) {
        console.error('Error fetching presigned URL:', error);
        return Response.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}