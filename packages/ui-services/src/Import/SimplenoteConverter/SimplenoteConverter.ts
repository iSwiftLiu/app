import { DecryptedTransferPayload, NoteContent } from '@standardnotes/models'
import { ContentType } from '@standardnotes/common'
import { readFileAsText } from '../Utils'
import { WebApplicationInterface } from '@standardnotes/services'
import { Importer } from '../Importer'

type SimplenoteItem = {
  creationDate: string
  lastModified: string
  content: string
}

type SimplenoteData = {
  activeNotes: SimplenoteItem[]
  trashedNotes: SimplenoteItem[]
}

export class SimplenoteConverter extends Importer {
  constructor(protected override application: WebApplicationInterface) {
    super(application)
  }

  createNoteFromItem(item: SimplenoteItem, trashed: boolean): DecryptedTransferPayload<NoteContent> {
    const createdAtDate = new Date(item.creationDate)
    const updatedAtDate = new Date(item.lastModified)

    const splitItemContent = item.content.split('\r\n')
    const hasTitleAndContent = splitItemContent.length === 2
    const title =
      hasTitleAndContent && splitItemContent[0].length ? splitItemContent[0] : createdAtDate.toLocaleString()
    const content = hasTitleAndContent && splitItemContent[1].length ? splitItemContent[1] : item.content

    return {
      created_at: createdAtDate,
      created_at_timestamp: createdAtDate.getTime(),
      updated_at: updatedAtDate,
      updated_at_timestamp: updatedAtDate.getTime(),
      uuid: this.application.generateUUID(),
      content_type: ContentType.Note,
      content: {
        title,
        text: content,
        references: [],
        trashed,
        appData: {
          'org.standardnotes.sn': {
            client_updated_at: updatedAtDate,
          },
        },
      },
    }
  }

  async convertSimplenoteBackupFileToNotes(file: File): Promise<DecryptedTransferPayload<NoteContent>[]> {
    const content = await readFileAsText(file)

    const notes = this.parse(content)

    if (!notes) {
      throw new Error('Could not parse notes')
    }

    return notes
  }

  parse(data: string) {
    try {
      const parsed = JSON.parse(data) as SimplenoteData
      const activeNotes = parsed.activeNotes.reverse().map((item) => this.createNoteFromItem(item, false))
      const trashedNotes = parsed.trashedNotes.reverse().map((item) => this.createNoteFromItem(item, true))

      return [...activeNotes, ...trashedNotes]
    } catch (error) {
      console.error(error)
      return null
    }
  }
}