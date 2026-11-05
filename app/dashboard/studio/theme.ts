// AG Studio theme for the CreditRoll Live cutting room. Every colour points at a --cr-* token in
// app/globals.css, the same variables the shell's Tailwind classes and the two custom widgets use,
// so Studio reads as the desk the widgets sit on rather than a white component dropped into a
// dark page: change a token there and the shell, widgets, grids and charts all follow.

import { studioTheme } from 'ag-studio';

const token = (name: string) => `var(--cr-${name})`;
const line = (color: string) => ({ width: 1, color: token(color) });

const SANS = 'var(--font-archivo), "Helvetica Neue", Arial, sans-serif';
const DISPLAY = 'var(--font-bodoni), "Bodoni 72", Didot, Georgia, serif';

// Chart series in the order the cutting room reads them: splice amber, workprint cyan, bank ink,
// then the stamp colours. The endpoint pages keep PayPal's own series.
const SERIES = ['splice', 'workprint', 'bond-sky', 'paid', 'hold', 'grease', 'unclaimed', 'pending', 'bone', 'smoke'];

const palette = Object.fromEntries(
  SERIES.map((name, i) => [
    [`chartPaletteFills${i + 1}Color`, token(name)],
    [`chartPaletteStrokes${i + 1}Color`, token(name)],
  ]).flat(),
);

export const agStudioPayPalTheme = studioTheme.withParams({
  // Shared by Studio's UI, grids and charts.
  browserColorScheme: 'dark',
  fontFamily: SANS,
  fontSize: 13,
  textColor: token('bone'),
  foregroundColor: token('bone'),
  subtleTextColor: token('smoke'),
  backgroundColor: token('carbon'),
  borderColor: token('hairline'),
  accentColor: token('splice'),
  iconColor: token('smoke'),
  rowHoverColor: 'rgb(242 180 64 / 0.07)',
  menuBackgroundColor: token('graphite'),
  menuTextColor: token('bone'),
  menuSeparatorColor: token('hairline'),
  tooltipBackgroundColor: token('graphite'),
  tooltipTextColor: token('bone'),
  inputBackgroundColor: token('soot'),
  inputBorder: line('hairline-strong'),
  inputTextColor: token('bone'),
  inputPlaceholderTextColor: token('ash'),
  inputFocusBorder: line('splice'),
  inputIconColor: token('smoke'),

  // No frame: the canvas is the desk itself (see the lamp light in dashboard.tsx). Each widget
  // is inset 12px inside its grid cell, so 20px of padding puts widget edges on the header's gutter.
  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: 'transparent',
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: 'transparent',
  studioCanvasPadding: 20,
  studioCanvasRowHeight: 18,
  studioCanvasFontFamily: SANS,
  studioCanvasGridLineColor: token('hairline'),

  // Widgets are instrument panels on the desk: carbon fill, hairline edge, tight radius.
  studioWidgetBackgroundColor: token('carbon'),
  studioWidgetBorder: line('hairline'),
  studioWidgetBorderRadius: 6,
  studioWidgetPadding: 10,
  studioWidgetTitleFontFamily: DISPLAY,
  studioWidgetTitleFontSize: 16,
  studioWidgetTitleFontWeight: 500,
  studioWidgetTitleTextColor: token('bone'),
  studioWidgetSubtitleFontFamily: SANS,
  studioWidgetSubtitleFontSize: 12,
  studioWidgetSubtitleTextColor: token('smoke'),
  studioWidgetCaptionFontFamily: SANS,
  studioWidgetCaptionFontSize: 12,
  studioWidgetCaptionTextColor: token('smoke'),
  studioWidgetResizeBorderColor: token('splice'),
  studioWidgetToolbarBackgroundColor: token('graphite'),
  studioWidgetToolbarBorder: line('hairline-strong'),
  studioWidgetToolbarButtonColor: token('bone'),
  studioWidgetLoadingOverlayBackgroundColor: 'rgb(9 8 7 / 0.6)',
  studioWidgetNoDataOverlayBackgroundColor: 'transparent',
  studioValueWidgetFontSize: 26,

  // Edit-mode and filter panels read as more of the sidebar.
  studioPanelContainerBackgroundColor: token('soot'),
  studioPanelContainerBorder: line('hairline'),
  studioPanelContainerBorderRadius: 0,
  studioPanelDividerColor: token('hairline'),
  studioPanelDividerActiveColor: token('splice'),
  studioPanelSectionBorderColor: token('hairline'),
  studioPanelHeaderFontFamily: SANS,
  studioPanelHeaderFontWeight: 600,
  studioPanelGroupBackgroundColor: token('carbon'),
  studioPanelChevronButtonHoverBackgroundColor: token('graphite'),
  studioPanelChevronButtonHoverColor: token('splice'),
  studioToggleButtonActiveBackgroundColor: 'rgb(242 180 64 / 0.12)',
  studioToggleButtonActiveBorderColor: token('splice'),
  studioToggleButtonActiveColor: token('splice'),
  studioFiltersPanelCardSubtleColor: token('smoke'),

  // Grid widgets: the cue ledger, with condensed caps headers and tabular rows.
  gridFontFamily: SANS,
  gridFontSize: 13,
  gridCellTextColor: token('bone'),
  gridDataBackgroundColor: token('carbon'),
  gridOddRowBackgroundColor: 'rgb(255 255 255 / 0.015)',
  gridHeaderBackgroundColor: token('soot'),
  gridHeaderTextColor: token('smoke'),
  gridHeaderFontWeight: 600,
  gridHeaderFontSize: 12,
  gridRowHeight: 38,
  gridRowBorder: line('hairline'),
  gridHeaderRowBorder: line('hairline-strong'),
  gridPinnedRowBorder: line('hairline-strong'),
  gridRowHoverColor: 'rgb(242 180 64 / 0.07)',
  gridWrapperBorder: false,

  // Charts.
  chartFontFamily: SANS,
  chartTextColor: token('bone'),
  chartSubtleTextColor: token('smoke'),
  chartAxisLineColor: token('hairline-strong'),
  chartGridLineColor: token('hairline'),
  ...palette,
});
