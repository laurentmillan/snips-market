FROM node:latest

ENV HOME=/home/app

COPY ./package.json $HOME/app/package.json

WORKDIR $HOME/app
RUN npm install

COPY . $HOME

EXPOSE 80

CMD ["npm", "start"]
