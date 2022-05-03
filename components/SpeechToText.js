import React from 'react';
import {StyleSheet, Text, View, TouchableOpacity, Platform} from 'react-native';
import * as Permissions from 'expo-permissions';
import {Audio} from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

const LOCALE = 'pl-PL';

// const SPEECH_API_URL = 'http://192.168.25.67:1234/speech';
const SPEECH_API_URL = 'https://react-native-test-256510.appspot.com/speech';

export default class SpeechToText extends React.Component {

    state = {
        isRecording: false,
        isFetching: false,
        transcript: '',
    };
    recording = null;

    render() {
        const text = (this.state.isRecording ? 'Stop' : 'Record');
        return (
            <View style={styles.container}>
                <TouchableOpacity
                    style={this.state.isRecording ? styles.buttonStop : styles.buttonRecord}
                    onPress={this.toggleRecording}
                >
                    <Text style={styles.buttonText}>{text}</Text>
                </TouchableOpacity>
                <Text>{this.state.transcript}</Text>
            </View>
        );
    }

    toggleRecording = async () => {
        if (this.state.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording = async () => {
        console.log('start recording');
        if (!(await this.askPermissions())) return;
        this.setState({isRecording: true});

        const recordingOptions = {
            // android not currently in use, but parameters are required
            android: {
                extension: '.m4a',
                outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_AMR_WB,
                audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AMR_WB,
                sampleRate: 16000,
                numberOfChannels: 1,
                bitRate: 128000,
            },
            ios: {
                extension: '.wav',
                audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
                sampleRate: 44100,
                numberOfChannels: 1,
                bitRate: 128000,
                linearPCMBitDepth: 16,
                linearPCMIsBigEndian: false,
                linearPCMIsFloat: false,
            },
        };

        // some of these are not applicable, but are required
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
            playThroughEarpieceAndroid: true,
            staysActiveInBackground: false,
        });

        this.recording = new Audio.Recording();
        try {
            await this.recording.prepareToRecordAsync(recordingOptions);
            await this.recording.startAsync();
        } catch (error) {
            console.log(error);
            this.stopRecording();
        }
    }

    stopRecording = async () => {
        console.log('stop recording');
        this.setState({isRecording: false});
        if (this.recording) {
            this.recording.stopAndUnloadAsync();
            this.getTranscription();
        }
    }

    askPermissions = async () => {
        // request permissions to record audio
        const {status} = await Permissions.askAsync(Permissions.AUDIO_RECORDING);
        // if the user doesn't allow us to do so - return as we can't do anything further :(
        return (status === 'granted');
    }

    getTranscription = async () => {
        this.getTranscriptionFromBackend();
        return;
        this.setState({isFetching: true});
        try {
            // take the uri of the recorded audio from the file system
            const {uri, size} = await FileSystem.getInfoAsync(this.recording.getURI())
            // now we create formData which will be sent to our backend
            const formData = new FormData()
            formData.append('file', {
                uri,
                // as different audio types are used for android and ios - we should handle it
                type: Platform.OS === 'ios' ? 'audio/x-wav' : 'audio/m4a',
                name: Platform.OS === 'ios' ? `${Date.now()}.wav` : `${Date.now()}.m4a`,
            })
            console.log('before post length = ' + size)
            const response = await fetch(SPEECH_API_URL, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            this.setState({transcript: data.transcript});
        } catch (error) {
            console.log('There was an error reading file', error)
            // this.stopRecording()
            // we will take a closer look at resetRecording function further down
            this.resetRecording()
        }
        // set isFetching to false so the UI can properly react on that
        this.setState({isFetching: false})
    }

    getTranscriptionPhp = async () => {
        this.setState({isFetching: true});
        try {
            const info = await FileSystem.getInfoAsync(this.recording.getURI());
            console.log(`FILE INFO: ${JSON.stringify(info)}`);

            const url = 'http://192.168.25.67:8000';
            const audioContent = await FileSystem.readAsStringAsync(this.recording.getURI(), {encoding: FileSystem.EncodingType.Base64});
            const response = await axios.post(url, audioContent);
            console.log('Response: ' + response.data);
            this.setState({transcript: response.data});

        } catch (error) {
            console.log('There was an error', error);
            this.resetRecording();
        }
        this.setState({isFetching: false});
    }

    getTranscriptionDirectly = async () => {
        this.setState({isFetching: true});
        try {
            const audioBytes = await FileSystem.readAsStringAsync(this.recording.getURI(), {encoding: FileSystem.EncodingType.Base64});
            // this is also a requirement from google
            const audio = {
                content: audioBytes,
            }
            const sttConfig = {
                // if you need punctuation set to true
                enableAutomaticPunctuation: false,
                encoding: "AMR_WB",
                // same rate as we use in our ffmpeg options
                sampleRateHertz: 16000,
                languageCode: LOCALE,
                model: "default"
            }
            // building up the request object
            const request = {
                audio: audio,
                config: sttConfig,
            }

            // now we finally pass it to the Google API and wait for the response
            const [response] = await client.recognize(request);
            // iterate through the words and join them to get a string
            const transcript = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\\n');
            console.log('Response: ' + transcript);
            this.setState({transcript: response.data});
        } catch (error) {
            console.log('There was an error', error);
            this.resetRecording();
        }
        this.setState({isFetching: false});
    }

    getTranscriptionFromBackend = async () => {
        this.setState({isFetching: true});
        try {
            const audioBytes = await FileSystem.readAsStringAsync(this.recording.getURI(), {encoding: FileSystem.EncodingType.Base64});
            const response = await axios.post(SPEECH_API_URL, {file: audioBytes});
            const transcript = response.data;
            console.log('Response: ' + transcript);
            this.setState({transcript: transcript});
        } catch (error) {
            console.log('There was an error axios:', error.response);
            this.resetRecording();
        }
        this.setState({isFetching: false});
    }

    resetRecording = async () => {
        if (this.recording) {
            await FileSystem.deleteAsync(this.recording.getURI());
            this.recording = null;
        }
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonRecord: {
        backgroundColor: 'red',
    },
    buttonStop: {
        backgroundColor: 'black',
    },
    buttonText: {
        padding: 20,
        color: 'white',
        fontSize: 30
    }
});

