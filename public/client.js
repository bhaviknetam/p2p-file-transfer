const fileInput = document.getElementById('fileInput');
const sendButton = document.getElementById('sendButton');
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const statusDiv = document.getElementById('status');
const fileSelect = document.getElementById('fileSelect');
const downloadButton = document.getElementById('downloadButton');

const signalingServerUrl = `ws://localhost:8080`;
const connection = new WebSocket(signalingServerUrl);
connection.onopen = () => console.log('Connected to signaling server');
connection.onmessage = receiveFile;

let file;
let receivedChunks = [];
let receivedSize = 0;
let receivedFiles = JSON.parse(localStorage.getItem('receivedFiles')) || {};

fileInput.addEventListener('change', () => {
    file = fileInput.files[0];
});

function sendFile() {
    if (!file) {
        console.error('No file selected');
        return;
    }
    const chunkSize = 1024 * 1024; // 1MB chunk size
    const totalChunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;

    const reader = new FileReader();

    reader.onload = function (e) {
        const arrayBuffer = e.target.result;

        if (currentChunk === 0) {
            const metadata = JSON.stringify({
                type: 'metadata',
                fileMetadata: {
                    name: file.name,
                    size: file.size
                }
            });
            connection.send(metadata);
            console.log(`Sending metadata for file: ${file.name}`);
            const sharedFiles = JSON.parse(localStorage.getItem('sharedFiles')) || [];
            sharedFiles.push({ name: file.name, url: URL.createObjectURL(file) });
            localStorage.setItem('sharedFiles', JSON.stringify(sharedFiles));
        }

        console.log(`Sending chunk ${currentChunk + 1} of ${totalChunks}`);
        const chunkData = JSON.stringify({
            type: 'chunk',
            chunk: arrayBufferToBase64(arrayBuffer) // Convert ArrayBuffer to Base64
        });
        connection.send(chunkData);

        if (++currentChunk < totalChunks) {
            readNextChunk();
        }
    };

    function readNextChunk() {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const blob = file.slice(start, end);
        reader.readAsArrayBuffer(blob);
    }

    readNextChunk();
};

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function receiveFile(event) {
    const data = event.data;

    if (typeof data === 'string') {
        try {
            const json = JSON.parse(data);

            if (json.type === 'metadata' && json.fileMetadata) {
                file = {
                    name: json.fileMetadata.name,
                    size: json.fileMetadata.size
                };
                receivedChunks = [];
                receivedSize = 0;
                console.log('File metadata received:', file);
            } else if (json.type === 'chunk' && json.chunk) {
                const arrayBuffer = base64ToArrayBuffer(json.chunk); // Convert from Base64
                processReceivedData(arrayBuffer);
            } else {
                console.error('Unknown data type received:', json.type);
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    } else {
        console.error('Unexpected data format received:', data);
    }
};

// Function to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function processReceivedData(arrayBuffer) {
    if (!file) {
        console.error('No file metadata received. Cannot process chunk.');
        return;
    }

    const blob = new Blob([arrayBuffer]);
    receivedChunks.push(blob);
    receivedSize += blob.size;

    console.log(`Received chunk size: ${blob.size}`);
    console.log(`Total received size: ${receivedSize}`);
    console.log(`Expected file size: ${file.size}`);

    // Update the progress bar
    const progressPercent = (receivedSize / file.size) * 100;
    progress.style.width = progressPercent + '%';

    if (receivedSize === file.size) {
        console.log('All chunks received. Combining and creating download link.');

        // Combine all chunks into a single Blob
        const receivedBlob = new Blob(receivedChunks);

        // Create a download link
        const downloadUrl = URL.createObjectURL(receivedBlob);

        // Store the received file
        receivedFiles[file.name] = downloadUrl;
        localStorage.setItem('receivedFiles', JSON.stringify(receivedFiles));

        // Append the file to the dropdown list
        const option = document.createElement('option');
        option.value = file.name;
        option.textContent = file.name;
        fileSelect.appendChild(option);

        // Enable the download button
        fileSelect.disabled = false;
        downloadButton.disabled = false;

        statusDiv.textContent = 'File Received!';
    }
}

downloadButton.addEventListener('click', () => {
    const selectedFile = fileSelect.value;
    if (selectedFile && receivedFiles[selectedFile]) {
        const a = document.createElement('a');
        a.href = receivedFiles[selectedFile];
        a.download = selectedFile;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        console.error('No file selected or file not found');
    }
});

sendButton.addEventListener('click', sendFile);

// Load files from localStorage on page load
document.addEventListener('DOMContentLoaded', function () {
    const storedFiles = JSON.parse(localStorage.getItem('receivedFiles')) || {};
    for (const fileName in storedFiles) {
        const option = document.createElement('option');
        option.value = fileName;
        option.textContent = fileName;
        fileSelect.appendChild(option);
    }
    fileSelect.disabled = Object.keys(storedFiles).length === 0;
    downloadButton.disabled = Object.keys(storedFiles).length === 0;
});
