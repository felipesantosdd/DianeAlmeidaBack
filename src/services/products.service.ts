import { date } from "zod";
import { AppDataSource } from "../data-source";
import { Product } from "../entities/products";
import { AppError } from "../error/error";
import { IProductRequest, IProductResponse } from "../interfaces/products.interfaces";
import { Request, Response } from "express";
import S3Storage from "../utils/S3Storage";




class ProductsServices {

    static ProductRepository = AppDataSource.getRepository(Product)

    static async findAll(): Promise<IProductResponse[] | any> {
        const response = await this.ProductRepository.find({ order: { code: 'DESC' }, relations: { contracts: true } })

        return response

    }

    static async create(product: IProductRequest | any): Promise<IProductResponse | any> {

        const code = product.code

        const productExist = await this.ProductRepository.findOne({
            where: { code },
        })

        if (productExist) {
            throw new AppError("Este Produto ja esta cadastrado", 409)
        }

        const newProduct = this.ProductRepository.create(product);
        await this.ProductRepository.save(newProduct);

        return newProduct

    }

    static async updatePopularity(productID: string): Promise<void> {

        try {
            // Busca o produto no banco de dados
            const product = await this.ProductRepository.findOne({
                where: { id: productID },
                relations: ['contracts'],
            });

            if (!product) {
                throw new Error(`Produto com ID ${productID} não encontrado.`);
            }

            // Atualiza a popularidade
            product.popularity = product.contracts.length;

            // Salva as alterações no banco de dados
            await this.ProductRepository.save(product);
        } catch (error) {
            // Lida com erros ou propaga exceções, dependendo do contexto
            console.error("Erro ao atualizar a popularidade do produto:", error);
            throw error; // Propaga a exceção para o chamador da função
        }

    }


    static async updateUnique(productID: string, update: IProductRequest): Promise<IProductResponse | any> {
        const product = await this.ProductRepository.findOne({
            where: { id: productID }
        })
        if (!product) {
            throw new AppError('Produto Não Encontrado', 404)
        }

        product.price = update.price || product.price
        product.description = update.description || product.description
        product.modelo = update.modelo || product.modelo
        product.totalValue = update.price * 3 || product.totalValue
        product.color = update.color || product.color

        await this.ProductRepository.save(product)

        return product
    }


    static async findUnique(id: string): Promise<IProductResponse | any> {

        const product = await this.ProductRepository.findOne({
            where: { id }, relations: ['contracts']
        })

        if (!product) {
            throw new AppError("Produto não encontrado", 404)
        }

        return product
    }

    static async deleteUnique(id: string): Promise<void> {
        await this.ProductRepository.delete(id)

        return
    }

    static async uploadImage(req: Request, res: Response) {
        try {

            const product = await this.ProductRepository.findOne({ where: { id: req.params.id } })

            if (!req.file) {
                return res.status(400).json({ error: 'Nenhuma imagem enviada' });
            }

            const s3Storage = new S3Storage()

            await s3Storage.saveFile(req.file.filename)

            product.image = `https://dianealmeida-modelos.s3.us-east-2.amazonaws.com/${req.file?.filename}`

            await this.ProductRepository.save(product)

            res.status(200).json(product);
        } catch (error) {
            console.error('Erro ao fazer upload da imagem:', error);
            res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
        }
    }

    static async getImage(name: string) {
        try {
            const s3Storage = new S3Storage();
            const fileBuffer = await s3Storage.getFile(name);

            // Se o arquivo não for encontrado, a função getFile já lançará um erro
            // Portanto, aqui podemos assumir que o arquivo foi encontrado com sucesso

            // Converter o buffer em um Blob
            const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });

            // Criar uma URL para o Blob
            const imageUrl = URL.createObjectURL(blob);

            return imageUrl;
        } catch (error) {
            console.log(error);
            return null; // Retorna null em caso de erro
        }
    }
}

export default ProductsServices;