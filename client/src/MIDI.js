import { action, observable } from 'mobx'

const store = observable({
  status: 'Initializing MIDI system',
  outputs: [ ],
  selectedOutputKey: null
})

export function getStatus () {
  return store.status
}

export function getOutputs () {
  return store.outputs
}

export function isSelected (outputKey) {
  return store.selectedOutputKey === outputKey
}

export const selectOutput = action('selectOutput', (outputKey) => {
  const access = window.midiAccess
  if (!access) return
  const output = access.outputs.get(outputKey)
  if (!output) return window.alert('No output key ' + outputKey + ' found')
  window.midiOutput = output
  setStatus('Using output: ' + output.name)
})

const setStatus = action('setStatus', (status) => {
  store.status = status
})

const handleAvailableOutputs = action('handleAvailableOutputs', (outputs) => {
  store.outputs = outputs
  for (const output of outputs) {
    if (store.selectedOutputKey === output.key) return
  }
  if (outputs.length) {
    store.selectedOutputKey = outputs[0].key
  } else {
    store.selectedOutputKey = null
  }
})

function ok (access) {
  window.midiAccess = access
  setStatus('Found MIDI outputs: ' + access.outputs.size)
  try {
    refreshOutputList(access)
  } catch (e) {
    setStatus('Cannot access MIDI output ' + e)
  }
}

function refreshOutputList (access) {
  const ports = [ ]
  const iterator = access.outputs.keys()
  for (;;) {
    const { done, value: key } = iterator.next()
    if (done) break
    ports.push({ key, name: access.outputs.get(key).name })
  }
  handleAvailableOutputs(ports)
  selectOutput(store.selectedOutputKey)
}

export function send (data) {
  console.log(data)
  if (window.midiOutput) {
    window.midiOutput.send(data)
  }
}

function addOutput (output) {
  const { id, name } = output;
  store.outputs = getOutputs().concat({ key: id , name })
}

function removeOutputById (id) {
  store.outputs = getOutputs().filter(_output => _output.key !== id)

  if (store.selectedOutputKey === id) {
    selectOutput(null)
    setStatus('Device Removed')
  }
}

function onStateChange (e) {
  if (!e.port || e.port.type !== 'output') return
  const outputs = getOutputs()
  const { id, connection, type } = e.port
  const output = outputs.find(_output => _output.key === id)
  output
    ? removeOutputById(id)
    : addOutput(e.port)
}

function init () {
  if (window.midiAccess) {
    setStatus('MIDI saved!!')
    ok(window.midiAccess)
    return
  }
  if (navigator.requestMIDIAccess) {
    setStatus('Requesting MIDI access')
    navigator.requestMIDIAccess({ sysex: false }).then(
      (access) => {
        ok(access)
        access.onstatechange = onStateChange
      },
      (e) => {
        setStatus('MIDI cannot request!! ' + e)
      }
    )
  } else if (
    /* global webkit */
    typeof webkit !== 'undefined' &&
    webkit.messageHandlers &&
    webkit.messageHandlers.send &&
    webkit.messageHandlers.send.postMessage
  ) {
    ok(sham(webkit.messageHandlers.send))
  } else {
    setStatus('MIDI not supported')
  }
}

function sham (port) {
  const midiAccess = {
    outputs: new Map()
  }
  midiAccess.outputs.set('bluetooth', {
    name: 'Bluetooth',
    send: (bytes) => port.postMessage(bytes.join(';'))
  })
  return midiAccess
}

setTimeout(init)
