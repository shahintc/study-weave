import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';

const ENV_FILE_NAME = '.env'

const questions = [
    {
        type: 'input',
        name: 'DB_NAME',
        message: "Database Name:"
    },
    {
        type: 'input',
        name: 'DB_USER',
        message: "Database User:",
        default: 'postgres'
    },
    {
        type: 'password',
        name: 'DB_PASSWORD',
        message: 'Database Password: ',
        mask: '*'
    },
    {
        type: 'input',
        name: 'DB_HOST',
        message: 'Database Host (localhost or database url):',
        default: 'localhost'
    },
    {
        type: 'input',
        name: 'DB_PORT',
        message: 'Database Port:',
        default: '5432'
    },
    {
        type: 'input',
        name: 'GEMINI_API_KEY',
        message: 'Gemini API Key (AI features will not work unless set): ',
    },
    {
        type: 'input',
        name: 'GEMINI_LLM_NAME',
        message: 'Gemini LLM Model (e.g., gemini-2.5-flash):',
        default: 'gemini-2.5-flash'
    },
    {
        type: 'input',
        name: 'SMTP_HOST',
        message: 'SMTP Host (necessary for email authentication):',
        default: 'localhost'
    },
    {
        type: 'input',
        name: 'SMTP_PORT',
        message: 'SMTP Port:',
        default: '2525'
    },
    {
        type: 'input',
        name: 'SMTP_USER',
        message: 'SMTP User:',
    },
    {
        type: 'password',
        name: 'SMTP_PASS',
        message: 'SMTP Password:',
        mask: '*'
    },
    {
        type: 'input',
        name: 'EMAIL_FROM',
        message: 'Email "From" Field:'
    }
];

function gracefulExit(message, code = 0) {
    console.log(`\n\n${message}: Quitting...`);
    process.exit(code);
}

async function runCli() {
    console.log('✨ Welcome to the StudyWeave setup wizard! ✨');
    console.log(`\nYou'll have to answer some questions to get started.\n`);

    try {
        const filePath = path.join(process.cwd(), ENV_FILE_NAME);

        try {
            await fs.access(filePath);
            const { overwrite } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'overwrite',
                    message: 'You already have a config file! Would you like to overwrite?',
                    default: false
                },
            ]);

            if (!overwrite) {
                gracefulExit('File not modified');
                return;
            }
        } catch (error) {
            // file doesn't exist, which is fine
        }

        const answers = await inquirer.prompt(questions);

        const envContent = Object.entries(answers)
            .map(([key,value]) => {
                const safeValue = (typeof value == 'string' && value.includes(' '))
                    ? `"${value}"`
                    : value;

                return `${key} = ${safeValue}`;
            })
            .join('\n')
        await fs.writeFile(filePath, envContent + '\n');

        console.log('Done! Your configurations have been saved.')
        console.log('Feel free to start your application.')

    } catch (error) {
        if (error.isTtyError) {
            console.error("Prompt couldn't be rendered in the current environment.");
        } else if (error.message.includes('User force closed the prompt')) {
            gracefulExit('Ctrl+C interrupt')
        } else {
            console.error("Error during config creation:", error.message);
            gracefulExit('Setup failed due to error')
        }
    }
}

runCli();
