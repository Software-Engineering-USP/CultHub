FROM node:22.23.4-alpine3.24

WORKDIR /app

COPY package.json package-lock.json ./
# O Vite grava o cache em node_modules, então o usuário node precisa ser o dono.
RUN npm ci --ignore-scripts && chown -R node:node node_modules

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

USER node

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]