# Next.js app + the TypeScript pipeline scripts. Dev-oriented: this is a
# sketchbook, so we run `next dev` and keep rebuilds fast.
FROM node:22-slim

# sharp needs nothing extra on Debian slim for prebuilt binaries; lancedb ships
# prebuilt too. Keep the image lean.
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
