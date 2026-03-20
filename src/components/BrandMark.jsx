export default function BrandMark({
  className = '',
  titleClassName = '',
  logoClassName = '',
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <img
        src="/logo-proman.png"
        alt="ProMan logo"
        className={logoClassName || 'h-10 w-10 rounded-2xl object-cover shadow-sm'}
      />
      <span className={titleClassName || 'text-xl font-bold tracking-tight text-slate-900 dark:text-white'}>
        ProMan
      </span>
    </span>
  )
}
