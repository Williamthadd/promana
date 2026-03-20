export default function MadeByFooter({ className = '' }) {
  return (
    <footer className={`text-center ${className}`.trim()}>
      <a
        href="https://www.linkedin.com/in/william-thaddeus-6151751a7/"
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-slate-500 transition hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-200"
      >
        made by me
      </a>
    </footer>
  )
}
