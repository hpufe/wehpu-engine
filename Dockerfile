FROM node:boron

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json .

ARG DEBIAN_FRONTEND=noninteractive
RUN npm install \
    && apt-get update \
    && apt-get install -y apt-utils \
    && apt-get install -y tesseract-ocr \
    && apt-get install -y graphicsmagick \
    && apt-get install -y imagemagick

# Bundle app source
# COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]