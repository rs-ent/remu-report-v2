/** @type {import('next').NextConfig} */
import 'dotenv/config';

const nextConfig = {
    env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    },
    images: {
        domains: [
            'firebasestorage.googleapis.com',
            'cdnimg.melon.co.kr',
            'search.pstatic.net',
        ],
    },
};

export default nextConfig;