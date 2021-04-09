import AppError from '../errors/AppError';

import { getCustomRepository, getRepository } from 'typeorm'

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface Request {
  title: string,
  value: number,
  type: 'income' | 'outcome',
  category: string
}
class CreateTransactionService {
  public async execute({ title, value, type, category }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository)


    if (type === 'outcome') {
      const balance = await transactionsRepository.getBalance()
      if (value > balance.total) {
        throw new AppError('You do not have enough balance')
      }
    }

    const resolvedCategory = await this.resolveCategory(category)

    const transaction = transactionsRepository.create({ title, value, type, category: resolvedCategory })

    await transactionsRepository.save(transaction)

    return transaction
  }

  private async resolveCategory(title: string): Promise<Category> {
    const categoryRepository = getRepository(Category)

    let resolvedCategory = await categoryRepository.findOne({
      where: {
        title
      }
    })

    if (!resolvedCategory) {
      resolvedCategory = categoryRepository.create({ title })
      await categoryRepository.save(resolvedCategory)
    }


    return resolvedCategory
  }
}

export default CreateTransactionService;
