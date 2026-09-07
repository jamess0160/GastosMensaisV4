import nodemailer from "nodemailer"
import { enviromentManager } from "./enviromentManager"

export class NodeMailer {

    private readonly nodeMailer = nodemailer.createTransport({
        host: enviromentManager.getEnv("MAIL_SMTP", false),
        port: Number(enviromentManager.getEnv("MAIL_SMTP_PORT", false)),
        secure: enviromentManager.getEnv("MAIL_SMTP_SECURE", false) === "true",
        ignoreTLS: true,
        auth: {
            user: enviromentManager.getEnv("MAIL_USER", false),
            pass: enviromentManager.getEnv("MAIL_PASSWORD", false),
        },
    })

    public async run(subject: string, text: string, emails: string[]) {
        return new Promise<boolean>((resolve, reject) => {
            this.nodeMailer.sendMail({
                from: process.env.MAIL_USER,
                to: emails.join(", "),
                subject: subject,
                text: text,
            }, (error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(true)
                }
            })
        })
    }
}