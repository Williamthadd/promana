import { LANGUAGE_COLORS } from '../constants/languageColors'
import { getLanguageList } from '../utils/projectLanguages'

const COLOR_CLASS_BY_HEX = {
  [LANGUAGE_COLORS.TypeScript]: 'bg-[#3178C6]',
  [LANGUAGE_COLORS.JavaScript]: 'bg-[#F7DF1E]',
  [LANGUAGE_COLORS.Python]: 'bg-[#3572A5]',
  [LANGUAGE_COLORS.Go]: 'bg-[#00ADD8]',
  [LANGUAGE_COLORS.Rust]: 'bg-[#DEA584]',
  [LANGUAGE_COLORS.HTML]: 'bg-[#E34C26]',
  [LANGUAGE_COLORS.CSS]: 'bg-[#563D7C]',
  [LANGUAGE_COLORS.Java]: 'bg-[#B07219]',
  [LANGUAGE_COLORS.Ruby]: 'bg-[#CC342D]',
  [LANGUAGE_COLORS.PHP]: 'bg-[#4F5D95]',
  [LANGUAGE_COLORS.Other]: 'bg-[#8B8B8B]',
}

function getColorClass(language) {
  return (
    COLOR_CLASS_BY_HEX[LANGUAGE_COLORS[language] ?? LANGUAGE_COLORS.Other] ??
    COLOR_CLASS_BY_HEX[LANGUAGE_COLORS.Other]
  )
}

export default function LanguageBar({ languages }) {
  const entries = getLanguageList(languages)

  if (!entries.length) {
    return null
  }

  return (
    <div className="grid gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        Languages
      </p>

      <div className="flex flex-wrap gap-3">
        {entries.map((language) => (
          <div
            key={language}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${getColorClass(language)}`} />
            <span>{language}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
