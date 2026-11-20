"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Snippet,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Image,
} from "@heroui/react";
import { type SaleTransaction, getSales } from "@/lib/api/sales";
import { formatCurrency } from "@/lib/utils/numbers";

const ITEMS_PER_PAGE = 10;

function formatDate(d?: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

function formatUsd(amount?: string | null): string {
  return `$${formatCurrency(amount ?? "0")}`;
}

export function SalesPage() {
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<SaleTransaction | null>(null);

  useEffect(() => {
    const fetchSales = async () => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const data = await getSales({ limit: ITEMS_PER_PAGE, offset });
        setSales(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        console.error("Error fetching sales:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, [page]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)), [total]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-start gap-10 w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Sales
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading sales...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-10 w-full">
      <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
        Sales
      </h2>
      <div className="grid items-end gap-5 w-full">
      <Table
          aria-label="Deposits table"
          classNames={{
            base: "grid",
            wrapper: "bg-transparent shadow-none",
            table: "min-w-full",
            thead: "bg-transparent",
            th: "px-0 py-0 text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71] border-b border-[rgba(63,71,84,0.24)] h-[15px]",
            tbody: "bg-transparent",
            tr: "h-5 border-b border-[rgba(63,71,84,0.24)]",
            td: "px-0 py-0 text-sm leading-[15px] tracking-[-0.02em] font-medium",
          }}
        >
          <TableHeader>
            <TableColumn key="number" className="text-center w-[5%] ">#</TableColumn>
            <TableColumn key="amount" className="text-center w-[15%]">Amount</TableColumn>
            <TableColumn key="items" className="text-center py-3 w-[10%]">Items</TableColumn>
            <TableColumn key="transaction" className="text-center w-[35%]">Transaction ID</TableColumn>
            <TableColumn key="date" className="text-center w-[20%]">Date</TableColumn>
            <TableColumn key="action" className="text-right pr-2 w-[15%]">Action</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No sales found.">
            {sales.map((sale, index) => (
              <TableRow key={sale.id}>
                <TableCell className="text-center py-2">
                  <span className="text-white whitespace-nowrap">
                    {(page - 1) * ITEMS_PER_PAGE + index + 1}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-white whitespace-nowrap px-2">{formatUsd(sale.amount)}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-white whitespace-nowrap px-2">{sale.itemCount ?? sale.items?.length ?? 0}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Snippet
                    symbol=""
                    variant="solid"
                    className="text-white whitespace-nowrap px-2"
                    classNames={{ base: "bg-transparent", pre: "truncate max-w-[240px]" }}
                  >
                    {sale.intentId || "------"}
                  </Snippet>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-white whitespace-nowrap px-2">{formatDate(sale.createdAt)}</span>
                </TableCell>
                <TableCell className="text-right pr-2">
                  <Button className="bg-transparent text-primary-400" onPress={() => setSelected(sale)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pages > 1 && (
          <div className="flex justify-center mt-4">
            <Pagination
              total={pages}
              page={page}
              onChange={setPage}
              color="primary"
              classNames={{
                wrapper: "gap-0",
                item: "w-8 h-8 text-sm text-white bg-transparent",
                cursor: "bg-primary-400",
              }}
            />
          </div>
        )}
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} size="lg" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Sold items</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-row items-center justify-between">
                    <span className="text-sm text-[#6c6c71]">Transaction</span>
                    <Snippet
                      symbol=""
                      variant="solid"
                      className="text-white"
                      classNames={{ base: "bg-transparent", pre: "truncate max-w-[260px]" }}
                    >
                      {selected?.intentId ?? ""}
                    </Snippet>
                  </div>

                  <div className="flex flex-row items-center justify-between">
                    <span className="text-sm text-[#6c6c71]">Total</span>
                    <span className="text-white">{formatUsd(selected?.amount ?? "0")}</span>
                  </div>

                  <div className="w-full h-px bg-[rgba(63,71,84,0.24)]" />

                  <div className="flex flex-col gap-2">
                    {(selected?.items ?? []).map((it) => (
                      <div
                        key={it.cartItemId}
                        className="flex flex-row items-center justify-between gap-3 py-2 border-b border-[rgba(63,71,84,0.24)]"
                      >
                        <div className="flex flex-row items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-[rgba(63,71,84,0.12)] rounded-md shrink-0 flex items-center justify-center">
                            {it.imageUrl ? (
                              <Image
                                src={it.imageUrl}
                                alt={it.title ?? "item"}
                                width={40}
                                height={40}
                                className="w-10 h-10 object-contain"
                              />
                            ) : null}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white truncate">{it.title ?? "Unknown item"}</span>
                            <span className="text-xs text-[#6c6c71] truncate">{it.cartItemId}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-white">{formatUsd(it.value ?? "0")}</span>
                          <span className="text-xs text-[#6c6c71]">{it.currency ?? "USD"}</span>
                        </div>
                      </div>
                    ))}
                    {(selected?.items ?? []).length === 0 && (
                      <span className="text-sm text-[#6c6c71]">No items found for this sale.</span>
                    )}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
