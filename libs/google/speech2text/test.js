const LOCALE = 'pl-PL';
const SpeechClient = require('./SpeechClient');
const client = new SpeechClient();

const fs = require('fs');
const audioBytes = fs.readFileSync('../../../assets/malpa.m4a').toString('base64');

client
    .setLocale(LOCALE)
    .recognize(audioBytes)
    .then(transcript => console.log('transcript = ' + transcript))
    .catch(e => console.error(e.response));

