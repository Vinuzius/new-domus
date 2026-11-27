'use client';

import { useEffect, useRef, useState } from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { Calendar, X } from 'lucide-react';
import {
  civilDateToLocalDate,
  formatCivilDateBR,
  localDateToCivilDate,
  maskCivilDateBRInput,
  parseCivilDateBRToISO,
} from '@/lib/domain/dates';

interface DatePickerInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  onInvalidInput?: (message: string | null) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  disabled?: boolean;
}

const CALENDAR_START_MONTH = new Date(2000, 0, 1);
const CALENDAR_END_MONTH = new Date(2050, 11, 31);

export function DatePickerInput({
  id,
  label,
  value,
  onChange,
  onInvalidInput,
  minDate,
  maxDate,
  placeholder = 'DD/MM/AAAA',
  disabled = false,
}: DatePickerInputProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const [prevPropValue, setPrevPropValue] = useState(value);
  const [textValue, setTextValue] = useState(() =>
    value ? formatCivilDateBR(value) : ''
  );

  const selectedDate = value ? civilDateToLocalDate(value) : null;
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    () => selectedDate ?? new Date()
  );

  if (prevPropValue !== value) {
    setPrevPropValue(value);
    setTextValue(value ? formatCivilDateBR(value) : '');
    const syncedDate = value ? civilDateToLocalDate(value) : null;
    if (syncedDate) {
      setVisibleMonth(syncedDate);
    }
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const minLocalDate = minDate ? civilDateToLocalDate(minDate) : null;
  const maxLocalDate = maxDate ? civilDateToLocalDate(maxDate) : null;

  const disabledMatchers: Matcher[] = [];
  if (minLocalDate) {
    disabledMatchers.push({ before: minLocalDate });
  }
  if (maxLocalDate) {
    disabledMatchers.push({ after: maxLocalDate });
  }

  function validateBoundaries(iso: string): string | null {
    if (minDate && iso < minDate) {
      return `${label} não pode ser anterior a ${formatCivilDateBR(minDate)}.`;
    }
    if (maxDate && iso > maxDate) {
      return `${label} não pode ser posterior a ${formatCivilDateBR(maxDate)}.`;
    }
    return null;
  }

  function handleTextChange(raw: string) {
    const masked = maskCivilDateBRInput(raw);
    setTextValue(masked);

    if (masked.length === 0) {
      onInvalidInput?.(null);
      if (value !== '') {
        onChange('');
      }
      return;
    }

    if (masked.length < 10) {
      onInvalidInput?.(null);
      return;
    }

    const iso = parseCivilDateBRToISO(masked);
    if (!iso) {
      onInvalidInput?.(`${label} inválida. Use o formato DD/MM/AAAA.`);
      return;
    }

    const boundaryError = validateBoundaries(iso);
    if (boundaryError) {
      onInvalidInput?.(boundaryError);
      return;
    }

    const local = civilDateToLocalDate(iso);
    if (local) {
      setVisibleMonth(local);
    }
    onInvalidInput?.(null);
    onChange(iso);
  }

  function handleBlur() {
    if (textValue.length > 0 && textValue.length < 10) {
      onInvalidInput?.(
        `${label} incompleta. Informe DD/MM/AAAA ou limpe o campo.`
      );
    }
  }

  function handleSelectDay(day: Date | undefined) {
    if (!day) return;
    const iso = localDateToCivilDate(day);
    if (!iso) return;

    const boundaryError = validateBoundaries(iso);
    if (boundaryError) {
      onInvalidInput?.(boundaryError);
      return;
    }

    setTextValue(formatCivilDateBR(iso));
    setVisibleMonth(day);
    onInvalidInput?.(null);
    onChange(iso);
    setOpen(false);
  }

  function handleClear() {
    setTextValue('');
    onInvalidInput?.(null);
    onChange('');
    setOpen(false);
  }

  function handleOpenCalendar() {
    if (disabled) return;
    if (selectedDate) {
      setVisibleMonth(selectedDate);
    } else if (minLocalDate && !maxLocalDate) {
      setVisibleMonth(minLocalDate);
    } else if (maxLocalDate && !minLocalDate) {
      setVisibleMonth(maxLocalDate);
    }
    setOpen((prev) => !prev);
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>

      <div className="relative mt-1 flex items-center">
        <button
          type="button"
          onClick={handleOpenCalendar}
          disabled={disabled}
          aria-label={`Abrir calendário para ${label}`}
          aria-expanded={open}
          aria-controls={`${id}-calendar-popover`}
          className="absolute left-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-50"
        >
          <Calendar className="h-4 w-4" />
        </button>

        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          disabled={disabled}
          value={textValue}
          onFocus={() => {
            if (!disabled) {
              setOpen(true);
            }
          }}
          onClick={() => {
            if (!disabled && !open) {
              setOpen(true);
            }
          }}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="block min-h-[40px] w-full rounded-lg border border-slate-300 bg-white py-1.5 pr-8 pl-10 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
        />

        {textValue && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label={`Limpar ${label}`}
            className="absolute right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id={`${id}-calendar-popover`}
          role="dialog"
          aria-label={`Calendário de ${label}`}
          className="absolute left-0 z-40 mt-2 w-auto max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg [--rdp-accent-color:#0f172a] [--rdp-accent-background-color:#f1f5f9] [--rdp-day-height:36px] [--rdp-day-width:36px] [--rdp-day_button-height:34px] [--rdp-day_button-width:34px] [--rdp-nav-height:36px] [--rdp-nav_button-height:32px] [--rdp-nav_button-width:32px]"
        >
          <DayPicker
            mode="single"
            locale={ptBR}
            weekStartsOn={0}
            captionLayout="dropdown"
            navLayout="around"
            startMonth={CALENDAR_START_MONTH}
            endMonth={CALENDAR_END_MONTH}
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            selected={selectedDate ?? undefined}
            onSelect={handleSelectDay}
            disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
            classNames={{
              root: 'text-sm text-slate-900 select-none',
              month_caption:
                'flex items-center justify-center h-9 font-semibold text-slate-900 capitalize',
              dropdowns: 'inline-flex items-center gap-1.5 text-sm font-medium',
              caption_label:
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-100 capitalize',
              weekday: 'text-xs font-medium text-slate-500 capitalize',
              day_button:
                'inline-flex items-center justify-center rounded-lg text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-900',
              selected:
                '[&>button]:bg-slate-900 [&>button]:text-white [&>button]:hover:bg-slate-800 [&>button]:border-slate-900',
              today: 'font-semibold text-teal-700',
              outside: 'text-slate-400 opacity-60',
              disabled: 'text-slate-300 opacity-50 pointer-events-none',
              button_previous:
                'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
              button_next:
                'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
            }}
          />

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                handleSelectDay(today);
              }}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
