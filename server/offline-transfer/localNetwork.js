import os from 'node:os'

const VIRTUAL_INTERFACE_PATTERN = /(docker|wsl|vpn|tailscale|zerotier|virtualbox|vmware|vethernet|hyper-v|loopback)/i
const PREFERRED_INTERFACE_PATTERN = /(wi-?fi|wireless|wlan|ethernet|^en\d|^eth\d)/i

export function isPrivateIPv4(address) {
  if (typeof address !== 'string') return false

  const octets = address.split('.').map(Number)
  if (
    octets.length !== 4
    || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false
  }

  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
}

function addressScore(name, address) {
  let score = 0

  if (address.startsWith('192.168.')) score += 30
  else if (address.startsWith('10.')) score += 20
  else score += 10

  if (PREFERRED_INTERFACE_PATTERN.test(name)) score += 10
  if (VIRTUAL_INTERFACE_PATTERN.test(name)) score -= 100

  return score
}

export function listPrivateIPv4Interfaces(interfaceMap = os.networkInterfaces()) {
  const results = []

  for (const [name, entries] of Object.entries(interfaceMap || {})) {
    for (const entry of entries || []) {
      const isIPv4 = entry.family === 'IPv4' || entry.family === 4
      if (
        !isIPv4
        || entry.internal
        || VIRTUAL_INTERFACE_PATTERN.test(name)
        || !isPrivateIPv4(entry.address)
      ) continue

      results.push({
        name,
        address: entry.address,
        score: addressScore(name, entry.address),
      })
    }
  }

  return results
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map(({ name, address }) => ({ name, address }))
}

export function selectPrivateIPv4Address(interfaces = listPrivateIPv4Interfaces(), requestedAddress) {
  if (requestedAddress) {
    return interfaces.find(entry => entry.address === requestedAddress) || null
  }

  return interfaces[0] || null
}

export function isLoopbackAddress(address) {
  if (!address) return false
  const normalized = String(address).toLowerCase()
  return normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '::ffff:127.0.0.1'
}
