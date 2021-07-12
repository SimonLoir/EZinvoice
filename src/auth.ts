import * as crypto from 'crypto';
export default class auth {
    static private_key = process.env.PRIVATE_KEY || `key`;
    static alg = 'sha512';

    /**
     * Generates a new json web token for the specified data
     * @param data The data of the web token
     * @param expire_in_seconds The duration of the token
     */
    static createJWT(data: any, expire_in_seconds: number = 24 * 60 * 60) {
        const now = new Date().getTime();
        const header = auth.base64URLEncode({
            exp: now + expire_in_seconds * 1000,
            date: now,
            alg: this.alg,
        });

        const body = auth.base64URLEncode(data);

        const signature = auth.sign(header, body);

        const token = header + '.' + body + '.' + signature;

        return { token, check: auth.check(token) };
    }

    /**
     * Encodes an object in a JSON to base64 string
     */
    static base64URLEncode(obj: any) {
        return Buffer.from(JSON.stringify(obj))
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }

    /**
     * Decodes a base64 JSON into an object
     * @param text
     */
    static base64URLDecode(text: string) {
        return JSON.parse(
            Buffer.from(
                text.replace(/\-/g, '+').replace(/\_/g, '/'),
                'base64'
            ).toString()
        );
    }

    /**
     * Returns the signature of a JWT
     * @param head The base64 encoded header
     * @param data The base64 encoded data
     * @param alg  The algorithm used to create the signature
     */
    static sign(head: string, data: string, alg: string = this.alg) {
        return crypto
            .createHmac(alg, this.private_key)
            .update(head + `/<head-data>/` + data)
            .digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }

    /**
     * Gives data about the JWT
     * @param token The JWT to check
     */
    static check(token: string): {
        valid: boolean;
        message?: string;
        data?: { header: any; body: any };
    } {
        try {
            const split = token.split('.');

            // The token is considered invalid if there are not exaclty 3 parts
            if (split.length != 3) return { valid: false };

            // Extracting the 3 parts from the token
            const [base64_header, base64_body, base64_signature] = split;

            // Decoding the header
            const header = auth.base64URLDecode(base64_header);

            // Checks that the token has not expired yet
            if (header.exp < new Date().getTime())
                return {
                    valid: false,
                    message:
                        'token expired (' +
                        new Date(header.exp).toLocaleString() +
                        ')',
                };

            // The token is invalid if the signature is not correct
            if (
                base64_signature !=
                auth.sign(base64_header, base64_body, header.alg)
            )
                return {
                    valid: false,
                };

            // At this point, the token is valid and its data can be trusted
            return {
                valid: true,
                data: {
                    header,
                    body: auth.base64URLDecode(base64_body),
                },
            };
        } catch (error) {
            return { valid: false };
        }
    }
}
