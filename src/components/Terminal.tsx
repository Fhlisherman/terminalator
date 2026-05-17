import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useSettings, TERMINAL_THEMES } from '../contexts/SettingsContext';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string;
}

export default function Terminal({ sessionId }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef    = useRef<XTerm | null>(null);
  const fitRef      = useRef<FitAddon | null>(null);

  const { settings } = useSettings();

  // ── Init once per session ─────────────────────────────────────────────────
  useEffect(() => {
    if (!terminalRef.current) return;

    const termTheme = TERMINAL_THEMES[settings.appTheme] ?? TERMINAL_THEMES.dark;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: `'${settings.termFont}', Menlo, Monaco, 'Courier New', monospace`,
      fontSize: settings.termFontSize,
      lineHeight: 1.4,
      theme: termTheme,
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    xtermRef.current = term;
    fitRef.current   = fitAddon;

    // Wait for the chosen font to be ready before fitting
    document.fonts.ready.then(() => {
      fitAddon.fit();
      invoke('terminal_resize', { sessionId, cols: term.cols, rows: term.rows }).catch(console.error);
    });

    let unlistenData: UnlistenFn | null = null;
    listen<string>(`terminal:data:${sessionId}`, event => {
      term.write(event.payload);
    }).then(u => { unlistenData = u; });

    term.onData(data => {
      invoke('terminal_input', { sessionId, data }).catch(console.error);
    });

    const handleResize = () => {
      fitAddon.fit();
      invoke('terminal_resize', { sessionId, cols: term.cols, rows: term.rows }).catch(console.error);
    };

    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    ro.observe(terminalRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
      if (unlistenData) unlistenData();
      xtermRef.current = null;
      fitRef.current   = null;
      term.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Respond to live settings changes ─────────────────────────────────────
  useEffect(() => {
    const term = xtermRef.current;
    const fit  = fitRef.current;
    if (!term || !fit) return;

    const fontSpec = `${settings.termFontSize}px '${settings.termFont}'`;

    // Ensure the font is loaded by the browser before telling xterm to use it
    document.fonts.load(fontSpec).then(() => {
      term.options.fontFamily = `'${settings.termFont}', Menlo, Monaco, 'Courier New', monospace`;
      term.options.fontSize   = settings.termFontSize;
      term.options.theme      = TERMINAL_THEMES[settings.appTheme] ?? TERMINAL_THEMES.dark;

      // Give the browser one frame to measure the new glyph dimensions
      requestAnimationFrame(() => {
        fit.fit();
        invoke('terminal_resize', { sessionId, cols: term.cols, rows: term.rows }).catch(console.error);
      });
    });
  }, [settings.termFont, settings.termFontSize, settings.appTheme, sessionId]);

  return <div className="terminal-container" ref={terminalRef} />;
}
