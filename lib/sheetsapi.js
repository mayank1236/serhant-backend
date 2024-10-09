import { google } from 'googleapis';
import { Readable } from 'stream';

export async function sentToSheet(value, spreadsheetId, sheetName) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.SHEETS_CLIENT_EMAIL,
        private_key: process.env.SHEETS_PRIVATE_KEY
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file', // Scope to access Google Drive
      ],
    });

    const client = await auth.getClient();

    const googleSheets = google.sheets({ version: 'v4', auth: client });
    const googleDrive = google.drive({ version: 'v3', auth: client });

    // Upload image to Google Drive and get the public URL (if image exists)
    const imageUrls = await Promise.all(
      value.attachments?.map(async (attachment) => {
        const buffer = Buffer.from(attachment.data.split(',')[1], 'base64');

        // Convert buffer to stream
        const bufferStream = bufferToStream(buffer);

        const response = await googleDrive.files.create({
          requestBody: {
            name: attachment.name,
            mimeType: attachment.type || 'image/png',
          },
          media: {
            mimeType: attachment.type || 'image/png',
            body: bufferStream,
          },
          fields: 'id',
        });

        const fileId = response.data.id;

        // Make the image publicly accessible
        await googleDrive.permissions.create({
          fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });

        // Get the public URL of the uploaded file
        const publicUrl = `https://drive.google.com/uc?id=${fileId}`;
        return publicUrl;
      }) || []
    );

    // Add image URLs to the form data
    if (imageUrls.length > 0) {
      value.attachments = imageUrls.join(', ');
    }

    // Add the data to Google Sheets
    await googleSheets.spreadsheets.values.append({
      auth,
      spreadsheetId,
      range: sheetName, // Name of the sheet
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [Object.values(value).map((v) => (Array.isArray(v) ? v.join(', ') : v))],
      },
    });
  } catch (err) {
    console.log(err);
  }
  return Response.json({});
}

// Helper function to convert buffer to stream
function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {}; // _read is required but we don't need to implement it
  readable.push(buffer);
  readable.push(null);
  return readable;
}
