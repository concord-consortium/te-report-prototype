FROM node:8

WORKDIR /te-report-prototype
COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD [ "npm", "start" ]
