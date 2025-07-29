// commandExecutor.js
const { exec } = require('child_process');
const util = require('util');

// Promisify the exec function to use it with async/await
const execPromise = util.promisify(exec);

async function runCommand(command) {
    try {
        console.log(`Executing command: ${command}`);
        const { stdout, stderr } = await execPromise(command);
        if (stderr) {
            console.error(`Stderr for ${command}: ${stderr}`);
            // Often, git commands use stderr for non-error status messages
            return stdout ? `Output: ${stdout}\nStatus: ${stderr}` : stderr;
        }
        return stdout || 'Command executed successfully.';
    } catch (error) {
        console.error(`Error executing command '${command}':`, error);
        return `Error executing command: ${error.message}`;
    }
}

module.exports = { runCommand };