import { Button, Column, Image, Input, Row, Slider, Text, View, type Style } from "@tarve/core";
import { trayIconPreview, trayIconStyles, trayNumberSize, type TrayAppearance, type TrayDevice } from "../win/battery-icon";
import { fromTrayHsl, hexColor, parseHexColor, toTrayHsl, trayBackground, trayDefaultColor, type TrayHsl } from "../win/tray-color";

export type TrayDraft = TrayAppearance & { tone?: TrayHsl; hex?: string };
export type TrayDrafts = Partial<Record<TrayDevice, TrayDraft>>;
export const trayDevices = [
  { id: "headset", label: "Headset" }, { id: "mouse", label: "Mouse" },
] as const;

export function sameTrayAppearance(a: TrayAppearance, b: TrayAppearance): boolean {
  return a.style === b.style && a.color === b.color && a.numberSize === b.numberSize;
}

export function invalidTrayColor(draft: TrayDraft): boolean {
  return draft.hex !== undefined && parseHexColor(draft.hex) === undefined;
}

const muted = "var(--muted-foreground)";
const border = "var(--border)";
const accent = "var(--primary)";
const controlTrack: Style = {
  width: "100%", height: 24, trackThickness: 8, trackInset: 8, thumbSize: 15,
};
const colorTrack: Style = {
  ...controlTrack, foreground: "transparent", thumbBorderColor: "#ffffff", thumbBorderWidth: 2,
  thumbShadow: { x: 0, y: 1, blur: 3, color: "#0008" },
};
const colorAxes = [
  { id: "hue", label: "Matiz", max: 359 },
  { id: "saturation", label: "Saturação", max: 100 },
  { id: "lightness", label: "Luminosidade", max: 100 },
] as const;

export function TraySettings({ device, draft, dark, selectDevice, edit }: {
  device: TrayDevice; draft: TrayDraft; dark: boolean;
  selectDevice: (device: TrayDevice) => void; edit: (draft: TrayDraft) => void;
}) {
  const rgb = draft.color ?? trayDefaultColor[device];
  const tone = draft.tone ?? toTrayHsl(rgb);
  const gradients: Record<keyof TrayHsl, string> = {
    hue: "linear-gradient(90deg, #ed4141, #e6cc38, #4ac966, #38bfc9, #4d63e5, #d54cca, #ed4141)",
    saturation: `linear-gradient(90deg, ${hexColor(fromTrayHsl({ ...tone, saturation: 0 }))}, ${hexColor(fromTrayHsl({ ...tone, saturation: 100 }))})`,
    lightness: `linear-gradient(90deg, #000000, ${hexColor(fromTrayHsl({ ...tone, lightness: 50 }))}, #ffffff)`,
  };
  const invalid = invalidTrayColor(draft);

  return <Column gap={12}>
    <Row align="center" justify="between" gap={8}>
      <Text size={13} weight={620}>Dispositivo</Text>
      <Row gap={4} padding={3} style={{ radius: 8, background: "var(--muted)" }}>
        {trayDevices.map(({ id, label }) => (
          <Button key={id} id={`tray-device-${id}`} size="sm" variant={id === device ? "secondary" : "ghost"}
            control={{ role: "tab", selected: id === device, label }}
            onClick={() => selectDevice(id)} style={{ width: 84, height: 30, padding: 0, radius: 6 }}>
            <Text size={13} weight={id === device ? 650 : 500}>{label}</Text>
          </Button>
        ))}
      </Row>
    </Row>
    <Row id="tray-style-choices" gap={4}>
      {trayIconStyles.map(({ id, label }) => {
        const selected = draft.style === id;
        return <Button key={id} id={`tray-style-${id}`} variant={selected ? "secondary" : "ghost"}
          control={{ role: "radio", group: "tray-styles", checked: selected, label }}
          onClick={() => edit({ ...draft, style: id })}
          style={{ flex: 1, minWidth: 0, height: 50, radius: 8, padding: 0 }}>
          <Column align="center" gap={4}>
            <Image src={trayIconPreview(device, id, dark, draft.color, draft.numberSize)} width={20} height={20} />
            <Text size={12} weight={selected ? 650 : 500}>{label}</Text>
          </Column>
        </Button>;
      })}
    </Row>
    <Column id="tray-adjustments" gap={8} padding={{ top: 8 }}
      style={{ borderWidth: { top: 1 }, borderColor: border }}>
      <Column id="tray-color-controls" gap={3}>
        <Row align="center" gap={8}>
          <Text size={14} weight={640} style={{ flex: 1 }}>Cor</Text>
          <View style={{ width: 18, height: 18, radius: 5, shrink: 0, background: hexColor(rgb),
            borderWidth: 1, borderColor: border }} />
          <label htmlFor="tray-color-hex"><span style={{ fontSize: 12, color: muted }}>HEX</span></label>
          <Input id="tray-color-hex" value={draft.hex ?? hexColor(rgb)} maxLength={7}
            onChange={hex => {
              const next = parseHexColor(hex);
              edit(next === undefined ? { ...draft, hex } : { ...draft, hex, color: next, tone: undefined });
            }}
            style={{ width: 84, minWidth: 84, height: 30, radius: 6, borderColor: invalid ? "var(--destructive-text)" : border }} />
          <Button id="tray-color-default" variant="ghost" size="sm" disabled={draft.color === undefined && draft.hex === undefined}
            onClick={() => edit({ ...draft, color: undefined, tone: undefined, hex: undefined })}
            style={{ height: 30, radius: 6, padding: { left: 6, right: 6 } }}>
            <Text size={12}>Usar padrão</Text>
          </Button>
        </Row>
        {colorAxes.map(({ id, label, max }) => (
          <Row key={id} align="center" gap={8}>
            <Text size={12} color={muted} style={{ width: 84, shrink: 0 }}>{label}</Text>
            <Column flex={1} style={{ minWidth: 0 }}>
              <Slider id={`tray-color-${id}`} label={label} value={tone[id]} min={0} max={max} step={1}
                onValueChange={value => {
                  const next = { ...tone, [id]: value };
                  edit({ ...draft, color: fromTrayHsl(next), tone: next, hex: undefined });
                }}
                style={{ ...colorTrack, trackBackground: gradients[id], thumbColor: hexColor(rgb) }} />
            </Column>
          </Row>
        ))}
        {invalid ? <Text id="tray-color-error" size={12} color="var(--destructive-text)">Use seis dígitos hexadecimais.</Text> : null}
      </Column>
      <Row id="tray-number-controls" align="center" gap={12} padding={{ top: 8 }}
        style={{ borderWidth: { top: 1 }, borderColor: border }}>
        <Column flex={1} gap={2} style={{ minWidth: 0 }}>
          <Row align="center" justify="between" gap={4}>
            <Text size={13} weight={640}>Tamanho do número</Text>
            <Text id="tray-number-percent" size={12} color={muted} style={{ fontFeatureSettings: "'tnum' 1", shrink: 0 }}>
              {`${draft.numberSize}%`}
            </Text>
          </Row>
          <Slider id="tray-number-size" label="Tamanho do número na bandeja" value={draft.numberSize}
            min={trayNumberSize.min} max={trayNumberSize.max} step={trayNumberSize.step}
            onValueChange={numberSize => edit({ ...draft, numberSize })}
            style={{ ...controlTrack, trackThickness: 4, trackBackground: "var(--muted)", foreground: accent, thumbColor: accent }} />
        </Column>
        <Row gap={4} style={{ width: 134, shrink: 0 }}>
          {([true, false] as const).map(previewDark => (
            <Row key={String(previewDark)} flex={1} gap={4} align="center" justify="center"
              style={{ height: 30, radius: 6, background: hexColor(trayBackground[previewDark ? "dark" : "light"]),
                borderWidth: 1, borderColor: border }}>
              <Image src={trayIconPreview(device, "number", previewDark, draft.color, draft.numberSize)} width={16} height={16} />
              <Text size={10} color={previewDark ? "#e5e5ed" : "#282832"}>{previewDark ? "Escura" : "Clara"}</Text>
            </Row>
          ))}
        </Row>
      </Row>
    </Column>
  </Column>;
}
