// commandExecutor.js
const { spawn } = require('child_process');

async function runCommand(command) {
    return new Promise((resolve, reject) => {
        console.log(`Executing command: ${command}`);
        // Split the command into the main program and its arguments
        const [cmd, ...args] = command.split(' ');

        const child = spawn(cmd, args, { shell: true }); // Use shell mode for compatibility

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        // This event will fire if the command itself cannot be found or started
        child.on('error', (error) => {
            console.error(`Spawn error for command '${command}':`, error);
            // We resolve with the error message so the AI can see it
            resolve(`Error starting command: ${error.message}`);
        });

        // This event fires when the command finishes
        child.on('close', (code) => {
            console.log(`Command '${command}' finished with exit code ${code}.`);
            
            const sanitize = (text) => {
                if (typeof text !== 'string') return '';
                return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
            };

            const sanitizedStdout = sanitize(stdout);
            const sanitizedStderr = sanitize(stderr);
            
            // Combine both stdout and stderr as Git often uses stderr for status messages
            const combinedOutput = `${sanitizedStdout}\n${sanitizedStderr}`.trim();

            resolve(combinedOutput || 'Command executed.');
        });
    });
}

module.exports = { runCommand };