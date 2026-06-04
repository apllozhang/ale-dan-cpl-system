#!/usr/bin/env node

/**
 * 导入证书和 eFlash 数据
 * 
 * 使用方式：
 * node scripts/import_certifications_eflash.mjs <证书文件路径> <eFlash文件路径>
 * 
 * 例如：
 * node scripts/import_certifications_eflash.mjs /home/ubuntu/upload/证书数据采集_可编辑.xlsx /home/ubuntu/upload/eFlash-合并数据表.xlsx
 */

import * as fs from 'fs';
import ExcelJS from 'exceljs';
import mysql from 'mysql2/promise';

// 获取数据库连接
async function getConnection() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL 环境变量未设置');
  }

  // 解析 DATABASE_URL
  const url = new URL(dbUrl);
  const [user, password] = url.username ? [url.username, url.password] : ['root', ''];
  const host = url.hostname;
  const port = url.port || 3306;
  const database = url.pathname.slice(1);

  console.log(`连接数据库: ${user}@${host}:${port}/${database}`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    ssl: {
      rejectUnauthorized: false,
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return connection;
}

// 导入证书数据
async function importCertifications(filePath, connection) {
  console.log('\n📋 开始导入证书数据...');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet('证书数据');
  if (!worksheet) {
    throw new Error('找不到"证书数据"工作表');
  }

  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // 跳过标题行
  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber++) {
    try {
      const row = worksheet.getRow(rowNumber);
      const values = row.values;

      if (!values || !values[1]) continue; // 跳过空行

      const certData = {
        certType: 'enterprise', // 默认企业认证
        certNo: values[1]?.toString() || '',
        certName: values[2]?.toString() || '',
        standardType: values[3]?.toString() || '',
        productCategory: values[4]?.toString() || '',
        productSeries: values[5]?.toString() || '',
        issuer: values[6]?.toString() || '',
        holder: values[7]?.toString() || '',
        factoryNo: values[8]?.toString() || '',
        testReportNo: values[9]?.toString() || '',
        certScope: values[10]?.toString() || '',
        issueDate: values[11] ? new Date(values[11]).toISOString().split('T')[0] : null,
        expiryDate: values[12] ? new Date(values[12]).toISOString().split('T')[0] : null,
        status: values[13]?.toString() || 'active',
        remark: values[14]?.toString() || '',
        createdBy: 1, // 系统导入用户
      };

      // 检查必填字段
      if (!certData.certNo || !certData.certName) {
        console.warn(`⚠️  行 ${rowNumber}: 缺少证书编号或证书名称，跳过`);
        skippedCount++;
        continue;
      }

      // 检查是否已存在
      const [existing] = await connection.query(
        'SELECT id FROM certifications WHERE certNo = ?',
        [certData.certNo]
      );

      if (existing.length > 0) {
        console.log(`✓ 行 ${rowNumber}: 证书 ${certData.certNo} 已存在，跳过`);
        skippedCount++;
        continue;
      }

      // 插入数据
      await connection.query(
        `INSERT INTO certifications (
          certType, certNo, certName, standardType, productCategory, productSeries,
          issuer, holder, factoryNo, testReportNo, certScope, issueDate, expiryDate,
          status, remark, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          certData.certType, certData.certNo, certData.certName, certData.standardType,
          certData.productCategory, certData.productSeries, certData.issuer, certData.holder,
          certData.factoryNo, certData.testReportNo, certData.certScope, certData.issueDate,
          certData.expiryDate, certData.status, certData.remark, certData.createdBy
        ]
      );

      importedCount++;
      if (importedCount % 50 === 0) {
        console.log(`✓ 已导入 ${importedCount} 条证书数据...`);
      }
    } catch (error) {
      console.error(`❌ 行 ${rowNumber} 导入失败:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✅ 证书数据导入完成:`);
  console.log(`   导入: ${importedCount} 条`);
  console.log(`   跳过: ${skippedCount} 条`);
  console.log(`   错误: ${errorCount} 条`);

  return { importedCount, skippedCount, errorCount };
}

// 导入 eFlash 数据
async function importEFlash(filePath, connection) {
  console.log('\n📋 开始导入 eFlash 数据...');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  const worksheet = workbook.getWorksheet('eFlash Records');
  if (!worksheet) {
    throw new Error('找不到"eFlash Records"工作表');
  }

  let importedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // 跳过标题行
  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber++) {
    try {
      const row = worksheet.getRow(rowNumber);
      const values = row.values;

      if (!values || !values[1]) continue; // 跳过空行

      const eflashData = {
        eflashId: values[1]?.toString() || '',
        type: values[2]?.toString() || '',
        division: values[3]?.toString() || '',
        scope: values[4]?.toString() || 'global',
        subjectEn: values[5]?.toString() || '',
        subjectCn: values[6]?.toString() || '',
        globalDate: values[7] ? new Date(values[7]).toISOString().split('T')[0] : null,
        chinaDate: values[8] ? new Date(values[8]).toISOString().split('T')[0] : null,
        effectiveDate: values[9] ? new Date(values[9]).toISOString().split('T')[0] : null,
        authorEn: values[10]?.toString() || '',
        authorCn: values[11]?.toString() || '',
        comments: values[12]?.toString() || '',
        createdBy: 1, // 系统导入用户
      };

      // 检查必填字段
      if (!eflashData.eflashId || !eflashData.subjectEn) {
        console.warn(`⚠️  行 ${rowNumber}: 缺少 eFlash ID 或主题，跳过`);
        skippedCount++;
        continue;
      }

      // 检查是否已存在
      const [existing] = await connection.query(
        'SELECT id FROM eflash_records WHERE eflashId = ?',
        [eflashData.eflashId]
      );

      if (existing.length > 0) {
        console.log(`✓ 行 ${rowNumber}: eFlash ${eflashData.eflashId} 已存在，跳过`);
        skippedCount++;
        continue;
      }

      // 插入数据（只导入数据库实际需要的字段）
      await connection.query(
        `INSERT INTO eflash_records (
          eflashId, type, division, scope, subjectEn, subjectCn, globalDate,
          chinaDate, effectiveDate, authorEn, authorCn, comments, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eflashData.eflashId, eflashData.type, eflashData.division, eflashData.scope,
          eflashData.subjectEn, eflashData.subjectCn, eflashData.globalDate,
          eflashData.chinaDate, eflashData.effectiveDate, eflashData.authorEn,
          eflashData.authorCn, eflashData.comments, eflashData.createdBy
        ]
      );

      importedCount++;
      if (importedCount % 50 === 0) {
        console.log(`✓ 已导入 ${importedCount} 条 eFlash 数据...`);
      }
    } catch (error) {
      console.error(`❌ 行 ${rowNumber} 导入失败:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✅ eFlash 数据导入完成:`);
  console.log(`   导入: ${importedCount} 条`);
  console.log(`   跳过: ${skippedCount} 条`);
  console.log(`   错误: ${errorCount} 条`);

  return { importedCount, skippedCount, errorCount };
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ 使用方式: node scripts/import_certifications_eflash.mjs <证书文件> <eFlash文件>');
    process.exit(1);
  }

  const certFile = args[0];
  const eflashFile = args[1];

  // 检查文件是否存在
  if (!fs.existsSync(certFile)) {
    console.error(`❌ 证书文件不存在: ${certFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(eflashFile)) {
    console.error(`❌ eFlash 文件不存在: ${eflashFile}`);
    process.exit(1);
  }

  let connection;

  try {
    connection = await getConnection();
    console.log('✅ 数据库连接成功');

    const certResults = await importCertifications(certFile, connection);
    const eflashResults = await importEFlash(eflashFile, connection);

    console.log('\n📊 导入汇总:');
    console.log(`   证书数据: ${certResults.importedCount} 导入, ${certResults.skippedCount} 跳过, ${certResults.errorCount} 错误`);
    console.log(`   eFlash 数据: ${eflashResults.importedCount} 导入, ${eflashResults.skippedCount} 跳过, ${eflashResults.errorCount} 错误`);

    const totalImported = certResults.importedCount + eflashResults.importedCount;
    const totalSkipped = certResults.skippedCount + eflashResults.skippedCount;
    const totalError = certResults.errorCount + eflashResults.errorCount;

    console.log(`\n✅ 总计: ${totalImported} 条导入, ${totalSkipped} 条跳过, ${totalError} 条错误`);

  } catch (error) {
    console.error('❌ 导入失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
