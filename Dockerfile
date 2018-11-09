FROM node:8

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm -g install yarn
RUN npm -g install bower
RUN wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
RUN chmod +x ~/.nvm/nvm.sh
RUN ~/.nvm/nvm.sh install "8.9.4"
RUN ~/.nvm/nvm.sh use "8.9.4"
RUN yarn install

WORKDIR /usr/src/app/client_app
COPY client_app/bower.json ./
RUN bower install --allow-root
WORKDIR /usr/src/app

RUN apt-get update
RUN apt-get install -y vim

COPY . .

EXPOSE 4242
# CMD ["sleep", "1d"]
CMD [ "npm", "start" ]