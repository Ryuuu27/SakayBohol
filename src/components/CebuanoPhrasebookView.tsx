import React, {useMemo, useState} from 'react';
import {Maximize2, Search, Volume2, X} from 'lucide-react';
import {CEBUANO_PHRASES} from '../data/boholTransitData';
import {CebuanoPhrase, PhraseCategory} from '../types/transit';

export const CebuanoPhrasebookView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | PhraseCategory>('ALL');
  const [preferBoholanoJ, setPreferBoholanoJ] = useState(true);
  const [driverCardPhrase, setDriverCardPhrase] = useState<CebuanoPhrase | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const filteredPhrases = useMemo(() => {
    return CEBUANO_PHRASES.filter((item) => {
      if (activeCategory !== 'ALL' && item.category !== activeCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.english.toLowerCase().includes(q) ||
        item.cebuano.toLowerCase().includes(q) ||
        (item.boholanoVariant?.toLowerCase().includes(q) ?? false) ||
        item.usageContext.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery]);

  const handleSpeak = (phrase: CebuanoPhrase) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const textToSpeak =
      preferBoholanoJ && phrase.boholanoVariant
        ? phrase.boholanoVariant
        : phrase.cebuano;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'fil-PH';
    utterance.rate = 0.86;
    utterance.onstart = () => setSpeakingId(phrase.id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  };

  const categories: Array<{key: 'ALL' | PhraseCategory; label: string}> = [
    {key: 'ALL', label: 'All Phrases'},
    {key: PhraseCategory.TRANSIT, label: 'Jeepney & Trike'},
    {key: PhraseCategory.BARGAINING, label: 'Fares & Money'},
    {key: PhraseCategory.DIRECTIONS, label: 'Directions'},
    {key: PhraseCategory.COURTESY, label: 'Boholano Greetings'},
    {key: PhraseCategory.EMERGENCY, label: 'Safety'},
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Cebuano &amp; Boholano Transit Phrasebook
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            100% offline Binisaya translations with syllable stress guides, voice
            pronunciation, and full-screen driver display cards.
          </p>
        </div>

        {/* Boholano Dialect Toggle */}
        <button
          type="button"
          onClick={() => setPreferBoholanoJ((v) => !v)}
          className={`min-h-[44px] self-start rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            preferBoholanoJ
              ? 'bg-teal-700 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {preferBoholanoJ
            ? 'Boholano "J" Dialect Active (Maajong)'
            : 'Standard Cebuano Spelling (Maayong)'}
        </button>
      </div>

      {/* Search & Category Controls */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search English or Cebuano (e.g., stop here, how much, change, thank you)..."
            className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear phrase search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex min-h-[40px] min-w-[40px] items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeCategory === cat.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Phrase List */}
        <div className="divide-y divide-slate-100 pt-1">
          {filteredPhrases.map((phrase) => {
            const displayedText =
              preferBoholanoJ && phrase.boholanoVariant
                ? phrase.boholanoVariant
                : phrase.cebuano;

            return (
              <div key={phrase.id} className="py-4 first:pt-2 last:pb-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 max-w-2xl">
                    <div className="text-xs text-slate-500">
                      {phrase.category}
                      {phrase.boholanoVariant
                        ? ' · Includes local Boholano dialect'
                        : ''}
                    </div>
                    <div className="text-lg font-bold text-teal-900">
                      {displayedText}
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                      {phrase.english}
                    </div>
                    <div className="font-mono text-xs text-slate-500">
                      Pronunciation: {phrase.phonetic}
                    </div>
                    <p className="text-xs text-slate-600 pt-0.5">
                      {phrase.usageContext}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSpeak(phrase)}
                      aria-label={`Listen to ${displayedText}`}
                      className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        speakingId === phrase.id
                          ? 'border-teal-700 bg-teal-50 text-teal-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Volume2 className="h-4 w-4 text-teal-700" />
                      <span>Listen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDriverCardPhrase(phrase)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Show Driver</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredPhrases.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              No Cebuano phrases matched &ldquo;{searchQuery}&rdquo;. Try searching
              &ldquo;fare&rdquo;, &ldquo;stop&rdquo;, or &ldquo;morning&rdquo;.
            </div>
          )}
        </div>
      </section>

      {/* High-Contrast Driver Flashcard Modal (ideal for noisy open-air tricycles/jeepneys) */}
      {driverCardPhrase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setDriverCardPhrase(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Show Screen to Driver or Conductor</span>
              <button
                type="button"
                onClick={() => setDriverCardPhrase(null)}
                aria-label="Close flashcard"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-6 space-y-3">
              <div className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
                {preferBoholanoJ && driverCardPhrase.boholanoVariant
                  ? driverCardPhrase.boholanoVariant
                  : driverCardPhrase.cebuano}
              </div>
              <div className="font-mono text-sm text-teal-800">
                {driverCardPhrase.phonetic}
              </div>
              <div className="border-t border-slate-100 pt-3 text-base text-slate-600">
                {driverCardPhrase.english}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSpeak(driverCardPhrase)}
                className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
              >
                <Volume2 className="h-4 w-4" />
                <span>Speak Phrase</span>
              </button>
              <button
                type="button"
                onClick={() => setDriverCardPhrase(null)}
                className="min-h-[48px] rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
