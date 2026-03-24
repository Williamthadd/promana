export default function BrandMark({
  className = '',
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <img
        src="/logo-proman.png"
        alt="ProMana logo"
        className="h-15 w-15"
      />
      <span
        className="hidden rounded-tr-lg rounded-br-lg px-2 py-0.5 text-xl font-bold tracking-tight text-white min-[460px]:inline"
        style={{ backgroundColor: '#31ACD3' }}
      >
        ProMana
      </span>
    </span>
  )
}