const axios = require('axios');

const DEFAULT_LOCALE = 'pl-PL';
const URL_RECOGNIZE = 'https://speech.googleapis.com/v1/speech:recognize?key=' + process.env.GOOGLE_API_KEY;

class SpeechClient {

    constructor(credentials) {
        this.credentials = credentials;
        this.locale = DEFAULT_LOCALE;
    }

    async recognize(audioBytes, config) {
        if (!config) config = this._getDefaultConfig();
        const request = {
            audio: {
                content: audioBytes,
            },
            config: config,
        };

        const response = await axios.post(URL_RECOGNIZE, request);
        const transcript = response.data.results
            .map(result => result.alternatives[0].transcript)
            .join('\\n');

        return transcript;
    }

    setLocale(locale) {
        this.locale = locale;
        return this;
    }

    _getDefaultConfig() {
        return {
            // if you need punctuation set to true
            enableAutomaticPunctuation: false,
            encoding: "AMR_WB",
            // same rate as we use in our ffmpeg options
            sampleRateHertz: 16000,
            languageCode: this.locale,
            model: "default"
        };
    }

}


module.exports = SpeechClient;
