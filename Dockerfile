FROM node:latest

ENV HOME=/home/app

COPY ./package.json $HOME/package.json

WORKDIR $HOME
RUN npm install

COPY . $HOME

EXPOSE 80

CMD ["npm", "start"]
