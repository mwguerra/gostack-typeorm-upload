import { getCustomRepository, getRepository, In } from 'typeorm'
import csvParse from 'csv-parse'
import fs from 'fs'

import Transaction from '../models/Transaction'
import Category from '../models/Category'
import TransactionsRepository from '../repositories/TransactionsRepository'

interface CSVTransaction {
  title: string,
  type: 'income' | 'outcome',
  value: number,
  category: string
}
class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const { transactions, categories } = await this.handleCSVFile(filePath)

    const createdTransactions = await this.saveTransactions(transactions, categories)

    await fs.promises.unlink(filePath)

    return createdTransactions
  }

  private async handleCSVFile(filePath: string) {
    const contactsReadStream = fs.createReadStream(filePath)

    const parser = csvParse({
      delimiter: ',',
      from_line: 2
    })

    const parseCSV = contactsReadStream.pipe(parser)

    const transactions: CSVTransaction[] = []
    const categories: string[] = []

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) => cell.trim())

      if (!title || !type || !value) {
        return
      }

      categories.push(category)
      transactions.push({ title, type, value, category })
    })

    await new Promise(resolve => parseCSV.on('end', resolve))

    return { transactions, categories }
  }

  private async saveTransactions(transactions: CSVTransaction[], categories: string[]): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository)

    const allCategories = await this.saveUniqueCategories(categories)

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(category => category.title === transaction.category)
      }))
    )

    await transactionsRepository.save(createdTransactions)

    return createdTransactions
  }

  private async saveUniqueCategories(categories: string[]) {
    const categoriesRepository = getRepository(Category)

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories)
      }
    })

    const existentCategoryTitles = existentCategories.map((category: Category) => category.title)
    const addCategoryTitles = categories
      .filter(category => !existentCategoryTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index)

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({ title }))
    )

    await categoriesRepository.save(newCategories)

    return [...newCategories, ...existentCategories]
  }
}

export default ImportTransactionsService;
