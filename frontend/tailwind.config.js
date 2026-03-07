/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    500: '#14b8a6', // Primary GPSWOX style teal
                    600: '#0d9488',
                    900: '#134e4a',
                },
                dark: {
                    bg: '#0f172a',    // Deep slate bg
                    card: '#1e293b',  // Elevated card
                    border: '#334155'
                }
            },
            fontFamily: {
                sans: ['"Inter"', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
