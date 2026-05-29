const { Storage } = require('@google-cloud/storage');

async function configureCors() {
  const storage = new Storage({
    projectId: 'tugga-nin',
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
  });

  const bucket = storage.bucket('tugga-nin.firebasestorage.app');

  const [metadata] = await bucket.getMetadata();
  console.log('Current CORS:', JSON.stringify(metadata.cors, null, 2));

  const cors = [
    {
      origin: ['https://tugga-nin.web.app', 'https://tugga-nin.firebaseapp.com', 'https://majiadigital.com.ng'],
      method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
      responseHeader: ['Content-Type', 'x-goog-content-length-range', 'x-goog-meta-*'],
      maxAgeSeconds: 3600
    }
  ];

  await bucket.setCorsConfiguration(cors);
  console.log('CORS configured successfully!');

  const [updated] = await bucket.getMetadata();
  console.log('Updated CORS:', JSON.stringify(updated.cors, null, 2));
}

configureCors().catch(console.error);
