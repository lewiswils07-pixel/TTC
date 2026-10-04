// The club's name, web addresses and colours, from app/brand.json.
// Screens import `brand` from here instead of typing the name.
import data from '../../brand.json'

export const brand = {
  name: data.name,
  shortName: data.shortName,
  tagline: data.tagline,
  webUrl: data.webUrl,
  appUrl: data.appUrl,
  supportEmail: data.supportEmail,
  /** The paid plan's name, for upgrade prompts and locked filters. */
  plusName: data.plusName,
} as const
