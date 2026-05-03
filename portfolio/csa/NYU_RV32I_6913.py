import argparse
import os
from dataclasses import dataclass, replace

MemSize = 1000
MASK32 = 0xFFFFFFFF
HALT_INSTR = 0xFFFFFFFF


def mask32(value):
    return value & MASK32


def sign_extend(value, width):
    sign_bit = 1 << (width - 1)
    return mask32((value & (sign_bit - 1)) - (value & sign_bit))


def bits(value, width):
    return format(value & ((1 << width) - 1), f"0{width}b")


def join_io(io_dir, filename):
    return os.path.join(io_dir, filename)


def read_word(memory, address):
    byte_slice = [
        memory[address + offset] if 0 <= address + offset < len(memory) else "00000000"
        for offset in range(4)
    ]
    return int("".join(byte_slice), 2)


def write_word(memory, address, value):
    result = list(memory)
    encoded = bits(value, 32)
    for offset in range(4):
        byte_address = address + offset
        if 0 <= byte_address < len(result):
            result[byte_address] = encoded[offset * 8 : (offset + 1) * 8]
    return result


def rf_read(registers, reg_addr):
    return registers[reg_addr]


def rf_write(registers, reg_addr, value):
    updated = list(registers)
    if reg_addr != 0:
        updated[reg_addr] = mask32(value)
    updated[0] = 0
    return tuple(updated)


@dataclass(frozen=True)
class DecodedInstruction:
    name: str
    instr_type: str
    opcode: int
    rd: int
    rs1: int
    rs2: int
    imm: int
    imm_bits: str
    writes_rd: bool
    uses_rs1: bool
    uses_rs2: bool
    is_load: bool
    is_store: bool
    is_branch: bool
    is_jump: bool
    alu_kind: str


@dataclass(frozen=True)
class IFState:
    nop: bool = False
    PC: int = 0


@dataclass(frozen=True)
class IDState:
    nop: bool = True
    Instr: int = 0


@dataclass(frozen=True)
class EXState:
    nop: bool = True
    instr: int = 0
    Read_data1: int = 0
    Read_data2: int = 0
    PC: int = 0
    Imm: int = 0
    Imm_bits: str = ""
    Rs: int = 0
    Rt: int = 0
    Wrt_reg_addr: int = 0
    is_I_type: bool = False
    rd_mem: int = 0
    wrt_mem: int = 0
    alu_op: str = "00"
    wrt_enable: int = 0
    func: str | None = None


@dataclass(frozen=True)
class MEMState:
    nop: bool = True
    ALUresult: int = 0
    Store_data: int = 0
    Rs: int = 0
    Rt: int = 0
    Wrt_reg_addr: int = 0
    rd_mem: int = 0
    wrt_mem: int = 0
    wrt_enable: int = 0


@dataclass(frozen=True)
class WBState:
    nop: bool = True
    Wrt_data: int = 0
    Rs: int = 0
    Rt: int = 0
    Wrt_reg_addr: int = 0
    wrt_enable: int = 0


@dataclass(frozen=True)
class State:
    IF: IFState = IFState()
    ID: IDState = IDState()
    EX: EXState = EXState()
    MEM: MEMState = MEMState()
    WB: WBState = WBState()


@dataclass(frozen=True)
class StepOutcome:
    next_state: State
    registers: tuple[int, ...]
    memory: list[str]
    instructions_executed: int
    halted: bool


ALU_OP_CODE = {
    "ADD": "00",
    "ADDI": "00",
    "LW": "00",
    "SW": "00",
    "JAL": "00",
    "SUB": "00",
    "AND": "01",
    "ANDI": "01",
    "OR": "10",
    "ORI": "10",
    "XOR": "11",
    "XORI": "11",
}


def decode_instruction(instr):
    opcode = instr & 0x7F
    rd = (instr >> 7) & 0x1F
    funct3 = (instr >> 12) & 0x7
    rs1 = (instr >> 15) & 0x1F
    rs2 = (instr >> 20) & 0x1F
    funct7 = (instr >> 25) & 0x7F

    if instr == HALT_INSTR or opcode == 0x7F:
        return DecodedInstruction("HALT", "H", opcode, 0, 0, 0, 0, "", False, False, False, False, False, False, False, "pass")

    if opcode == 0x33:
        name, alu_kind = {
            (0x0, 0x00): ("ADD", "add"),
            (0x0, 0x20): ("SUB", "sub"),
            (0x4, 0x00): ("XOR", "xor"),
            (0x6, 0x00): ("OR", "or"),
            (0x7, 0x00): ("AND", "and"),
        }[(funct3, funct7)]
        return DecodedInstruction(name, "R", opcode, rd, rs1, rs2, 0, "", True, True, True, False, False, False, False, alu_kind)

    if opcode == 0x13:
        imm_raw = (instr >> 20) & 0xFFF
        name, alu_kind = {
            0x0: ("ADDI", "add"),
            0x4: ("XORI", "xor"),
            0x6: ("ORI", "or"),
            0x7: ("ANDI", "and"),
        }[funct3]
        return DecodedInstruction(
            name, "I", opcode, rd, rs1, 0, sign_extend(imm_raw, 12), bits(imm_raw, 12),
            True, True, False, False, False, False, False, alu_kind
        )

    if opcode == 0x03 and funct3 in (0x0, 0x2):
        imm_raw = (instr >> 20) & 0xFFF
        return DecodedInstruction(
            "LW", "I", opcode, rd, rs1, 0, sign_extend(imm_raw, 12), bits(imm_raw, 12),
            True, True, False, True, False, False, False, "add"
        )

    if opcode == 0x23 and funct3 == 0x2:
        imm_raw = (((instr >> 25) & 0x7F) << 5) | ((instr >> 7) & 0x1F)
        return DecodedInstruction(
            "SW", "S", opcode, 0, rs1, rs2, sign_extend(imm_raw, 12), bits(imm_raw, 12),
            False, True, True, False, True, False, False, "add"
        )

    if opcode == 0x63:
        imm_raw = (
            (((instr >> 31) & 0x1) << 12)
            | (((instr >> 7) & 0x1) << 11)
            | (((instr >> 25) & 0x3F) << 5)
            | (((instr >> 8) & 0xF) << 1)
        )
        return DecodedInstruction(
            "BEQ" if funct3 == 0x0 else "BNE",
            "B",
            opcode,
            0,
            rs1,
            rs2,
            sign_extend(imm_raw, 13),
            bits(imm_raw, 13),
            False,
            True,
            True,
            False,
            False,
            True,
            False,
            "pass",
        )

    if opcode == 0x6F:
        imm_raw = (
            (((instr >> 31) & 0x1) << 20)
            | (((instr >> 12) & 0xFF) << 12)
            | (((instr >> 20) & 0x1) << 11)
            | (((instr >> 21) & 0x3FF) << 1)
        )
        return DecodedInstruction(
            "JAL", "J", opcode, rd, 0, 0, sign_extend(imm_raw, 21), bits(imm_raw, 21),
            True, False, False, False, False, False, True, "jal"
        )

    raise ValueError(f"Unsupported instruction 0x{instr:08x}")


def execute_op(name, lhs, rhs, pc):
    if name in ("ADD", "ADDI", "LW", "SW"):
        return mask32(lhs + rhs)
    if name == "SUB":
        return mask32(lhs + rhs)
    if name in ("XOR", "XORI"):
        return mask32(lhs ^ rhs)
    if name in ("OR", "ORI"):
        return mask32(lhs | rhs)
    if name in ("AND", "ANDI"):
        return mask32(lhs & rhs)
    if name == "JAL":
        return mask32(pc + 4)
    raise ValueError(f"Unsupported execute op {name}")


def single_stage_transition(state, registers, instr_mem, data_mem):
    if state.IF.nop:
        return StepOutcome(State(IF=replace(state.IF, nop=True)), registers, list(data_mem), 0, True)

    pc = state.IF.PC
    instr = read_word(instr_mem, pc)
    decoded = decode_instruction(instr)

    if decoded.name == "HALT":
        next_state = State(IF=IFState(nop=True, PC=pc))
        return StepOutcome(next_state, registers, list(data_mem), 1, False)

    lhs = rf_read(registers, decoded.rs1) if decoded.uses_rs1 else 0
    rhs = rf_read(registers, decoded.rs2) if decoded.uses_rs2 else decoded.imm
    next_pc = pc + 4
    next_registers = registers
    next_memory = list(data_mem)

    if decoded.is_branch:
        rs2_value = rf_read(registers, decoded.rs2)
        taken = (lhs == rs2_value) if decoded.name == "BEQ" else (lhs != rs2_value)
        if taken:
            next_pc = mask32(pc + decoded.imm)
    elif decoded.is_jump:
        next_registers = rf_write(registers, decoded.rd, mask32(pc + 4))
        next_pc = mask32(pc + decoded.imm)
    elif decoded.is_load:
        address = execute_op(decoded.name, lhs, decoded.imm, pc)
        next_registers = rf_write(registers, decoded.rd, read_word(data_mem, address))
    elif decoded.is_store:
        address = execute_op(decoded.name, lhs, decoded.imm, pc)
        next_memory = write_word(data_mem, address, rf_read(registers, decoded.rs2))
    else:
        if decoded.name == "SUB":
            rhs = mask32(-rhs)
        next_registers = rf_write(registers, decoded.rd, execute_op(decoded.name, lhs, rhs, pc))

    return StepOutcome(State(IF=IFState(nop=False, PC=next_pc)), next_registers, next_memory, 1, False)


def forward_value(state, registers, reg, mem_forward_value, ex_forward_value):
    if reg == 0:
        return 0, False

    if not state.EX.nop and state.EX.wrt_enable and state.EX.Wrt_reg_addr == reg:
        if state.EX.rd_mem:
            return 0, True
        return ex_forward_value, False

    if not state.MEM.nop and state.MEM.wrt_enable and state.MEM.Wrt_reg_addr == reg:
        return mem_forward_value, False

    if not state.WB.nop and state.WB.wrt_enable and state.WB.Wrt_reg_addr == reg:
        return state.WB.Wrt_data, False

    return rf_read(registers, reg), False


def mem_to_wb_transition(mem_stage, data_mem):
    if mem_stage.nop:
        return WBState(), list(data_mem), 0

    forward_value_from_mem = mem_stage.ALUresult
    next_memory = list(data_mem)
    if mem_stage.rd_mem:
        forward_value_from_mem = read_word(data_mem, mem_stage.ALUresult)
    if mem_stage.wrt_mem:
        next_memory = write_word(data_mem, mem_stage.ALUresult, mem_stage.Store_data)

    return (
        WBState(
            nop=False,
            Wrt_data=mask32(forward_value_from_mem),
            Rs=0,
            Rt=0,
            Wrt_reg_addr=mem_stage.Wrt_reg_addr,
            wrt_enable=mem_stage.wrt_enable,
        ),
        next_memory,
        mask32(forward_value_from_mem),
    )


def ex_to_mem_transition(ex_stage):
    if ex_stage.nop:
        return replace(ex_stage_to_mem_seed(ex_stage), nop=True), 0

    decoded = decode_instruction(ex_stage.instr)
    rhs = ex_stage.Imm if ex_stage.is_I_type else ex_stage.Read_data2
    alu_result = execute_op(decoded.name, ex_stage.Read_data1, rhs, ex_stage.PC)
    return (
        MEMState(
            nop=False,
            ALUresult=mask32(alu_result),
            Store_data=ex_stage.Read_data2,
            Rs=ex_stage.Rs,
            Rt=ex_stage.Rt,
            Wrt_reg_addr=ex_stage.Wrt_reg_addr,
            rd_mem=ex_stage.rd_mem,
            wrt_mem=ex_stage.wrt_mem,
            wrt_enable=ex_stage.wrt_enable,
        ),
        mask32(alu_result),
    )


def ex_stage_to_mem_seed(ex_stage):
    return MEMState(
        nop=True,
        ALUresult=0,
        Store_data=ex_stage.Read_data2,
        Rs=ex_stage.Rs,
        Rt=ex_stage.Rt,
        Wrt_reg_addr=ex_stage.Wrt_reg_addr,
        rd_mem=ex_stage.rd_mem,
        wrt_mem=ex_stage.wrt_mem,
        wrt_enable=ex_stage.wrt_enable,
    )


def decoded_to_ex_state(previous_ex, decoded, instr, pc, rs1_val, rs2_val, nop):
    read_data2 = rs2_val
    rt_value = decoded.rs2

    if decoded.name == "SUB":
        read_data2 = mask32(-rs2_val)
    elif decoded.instr_type == "I" and not decoded.is_store and not decoded.is_branch and not decoded.is_jump:
        read_data2 = previous_ex.Read_data2
        rt_value = previous_ex.Rt

    base = replace(
        previous_ex,
        nop=nop,
        instr=instr,
        Read_data1=rs1_val,
        Read_data2=read_data2,
        PC=pc,
        Rs=decoded.rs1,
        Rt=rt_value,
        func=decoded.name,
    )
    if decoded.instr_type != "R":
        base = replace(base, Imm=decoded.imm, Imm_bits=decoded.imm_bits)
    if decoded.is_jump:
        return replace(
            base,
            Wrt_reg_addr=decoded.rd,
            is_I_type=True,
            rd_mem=0,
            wrt_mem=0,
            alu_op="00",
            wrt_enable=0 if nop else 1,
        )
    return replace(
        base,
        Wrt_reg_addr=decoded.rd,
        is_I_type=decoded.instr_type in ("I", "S"),
        rd_mem=0 if nop else (1 if decoded.is_load else 0),
        wrt_mem=0 if nop else (1 if decoded.is_store else 0),
        alu_op=ALU_OP_CODE.get(decoded.name, "00"),
        wrt_enable=0 if nop else (1 if decoded.writes_rd else 0),
    )


def fetch_transition(state, instr_mem, instructions_executed, stall, branch_taken, branch_target, halt_seen):
    if halt_seen:
        return IFState(nop=True, PC=state.IF.PC), IDState(nop=True, Instr=state.ID.Instr), instructions_executed

    if branch_taken:
        return IFState(nop=False, PC=branch_target), IDState(nop=True, Instr=state.ID.Instr), instructions_executed

    if stall:
        return IFState(nop=state.IF.nop, PC=state.IF.PC), state.ID, instructions_executed

    if state.IF.nop:
        return IFState(nop=True, PC=state.IF.PC), IDState(), instructions_executed

    instr = read_word(instr_mem, state.IF.PC)
    if instr == HALT_INSTR:
        return IFState(nop=True, PC=state.IF.PC), IDState(nop=True, Instr=state.ID.Instr), instructions_executed + 1

    next_if = IFState(nop=False, PC=state.IF.PC + 4)
    next_id = IDState(nop=False, Instr=instr)
    return next_if, next_id, instructions_executed


def five_stage_transition(state, registers, instr_mem, data_mem):
    registers_after_wb = (
        rf_write(registers, state.WB.Wrt_reg_addr, state.WB.Wrt_data)
        if (not state.WB.nop and state.WB.wrt_enable)
        else registers
    )

    next_wb, memory_after_mem, mem_forward_value = mem_to_wb_transition(state.MEM, data_mem)
    if next_wb.nop:
        next_wb = replace(state.WB, nop=True, Rs=0, Rt=0)

    next_mem, ex_forward_value = ex_to_mem_transition(state.EX)
    if next_mem.nop:
        next_mem = replace(state.MEM, nop=True)

    next_ex = replace(state.EX, nop=True)
    next_id = replace(state.ID, nop=True)
    next_if = state.IF
    instructions_executed = 0
    stall = False
    branch_taken = False
    branch_target = state.IF.PC
    halt_seen = False

    if not state.ID.nop:
        instr = state.ID.Instr
        decoded = decode_instruction(instr)
        decode_pc = mask32(state.IF.PC - 4)

        if decoded.name == "HALT":
            halt_seen = True
            instructions_executed += 1
        else:
            rs1_val, stall = forward_value(state, registers_after_wb, decoded.rs1, mem_forward_value, ex_forward_value) if decoded.uses_rs1 else (0, False)
            rs2_val, stall_from_rs2 = forward_value(state, registers_after_wb, decoded.rs2, mem_forward_value, ex_forward_value) if decoded.uses_rs2 else (0, False)
            stall = stall or stall_from_rs2

            if stall:
                next_id = state.ID
                next_ex = replace(
                    state.EX,
                    nop=True,
                    instr=instr,
                    Wrt_reg_addr=0,
                    is_I_type=False,
                    rd_mem=0,
                    wrt_mem=0,
                    alu_op="00",
                    wrt_enable=0,
                    func=decoded.name,
                )
            elif decoded.is_branch:
                taken = (rs1_val == rs2_val) if decoded.name == "BEQ" else (rs1_val != rs2_val)
                instructions_executed += 1
                if taken:
                    branch_taken = True
                    branch_target = mask32(decode_pc + decoded.imm)
                next_id = IDState(nop=True, Instr=instr)
                next_ex = decoded_to_ex_state(state.EX, decoded, instr, decode_pc, rs1_val, rs2_val, True)
            elif decoded.is_jump:
                instructions_executed += 1
                branch_taken = True
                branch_target = mask32(decode_pc + decoded.imm)
                next_ex = decoded_to_ex_state(state.EX, decoded, instr, decode_pc, 0, 0, False)
                next_id = IDState(nop=True, Instr=instr)
            else:
                instructions_executed += 1
                next_ex = decoded_to_ex_state(state.EX, decoded, instr, decode_pc, rs1_val, rs2_val, False)

    next_if, fetched_id, instructions_executed = fetch_transition(
        state, instr_mem, instructions_executed, stall, branch_taken, branch_target, halt_seen
    )
    if not stall and not branch_taken and not halt_seen:
        next_id = fetched_id

    next_state = State(IF=next_if, ID=next_id, EX=next_ex, MEM=next_mem, WB=next_wb)
    halted = state.IF.nop and state.ID.nop and state.EX.nop and state.MEM.nop and state.WB.nop
    return StepOutcome(next_state, registers_after_wb, memory_after_mem, instructions_executed, halted)


class InsMem(object):
    def __init__(self, name, ioDir):
        self.id = name
        with open(join_io(ioDir, "imem.txt")) as im:
            loaded = [line.strip() for line in im.readlines()[:MemSize]]
        self.IMem = loaded + ["00000000"] * (MemSize - len(loaded))

    def readInstr(self, ReadAddress):
        return read_word(self.IMem, ReadAddress)


class DataMem(object):
    def __init__(self, name, ioDir):
        self.id = name
        self.ioDir = ioDir
        with open(join_io(ioDir, "dmem.txt")) as dm:
            loaded = [line.strip() for line in dm.readlines()[:MemSize]]
        self.DMem = loaded + ["00000000"] * (MemSize - len(loaded))

    def readInstr(self, ReadAddress):
        return self.readDataMem(ReadAddress)

    def readDataMem(self, ReadAddress):
        return read_word(self.DMem, ReadAddress)

    def writeDataMem(self, Address, WriteData):
        self.DMem = write_word(self.DMem, Address, WriteData)

    def replace_memory(self, updated_memory):
        self.DMem = list(updated_memory)

    def outputDataMem(self):
        resPath = join_io(self.ioDir, f"{self.id}_DMEMResult.txt")
        with open(resPath, "w") as rp:
            rp.writelines(f"{byte}\n" for byte in self.DMem)


class RegisterFile(object):
    def __init__(self, ioDir):
        self.outputFile = ioDir + "RFResult.txt"
        self.Registers = tuple(0 for _ in range(32))

    def readRF(self, Reg_addr):
        return rf_read(self.Registers, Reg_addr)

    def writeRF(self, Reg_addr, Wrt_reg_data):
        self.Registers = rf_write(self.Registers, Reg_addr, Wrt_reg_data)

    def replace_registers(self, updated_registers):
        self.Registers = tuple(updated_registers)

    def outputRF(self, cycle):
        lines = ["-" * 70 + "\n", "State of RF after executing cycle:" + str(cycle) + "\n"]
        lines.extend(f"{bits(value, 32)}\n" for value in self.Registers)
        with open(self.outputFile, "w" if cycle == 0 else "a") as file:
            file.writelines(lines)


class Core(object):
    def __init__(self, ioDir, imem, dmem):
        self.myRF = RegisterFile(ioDir)
        self.cycle = 0
        self.halted = False
        self.ioDir = ioDir
        self.state = State()
        self.nextState = State()
        self.ext_imem = imem
        self.ext_dmem = dmem
        self.instructions_executed = 0

    def commit_outcome(self, outcome):
        self.nextState = outcome.next_state
        self.myRF.replace_registers(outcome.registers)
        self.ext_dmem.replace_memory(outcome.memory)
        self.instructions_executed += outcome.instructions_executed
        self.halted = outcome.halted
        self.myRF.outputRF(self.cycle)
        self.printState(self.nextState, self.cycle)
        self.state = self.nextState
        self.cycle += 1


class SingleStageCore(Core):
    def __init__(self, ioDir, imem, dmem):
        super(SingleStageCore, self).__init__(ioDir + os.sep + "SS_", imem, dmem)
        self.opFilePath = join_io(ioDir, "StateResult_SS.txt")

    def step(self):
        outcome = single_stage_transition(self.state, self.myRF.Registers, self.ext_imem.IMem, self.ext_dmem.DMem)
        self.commit_outcome(outcome)

    def printState(self, state, cycle):
        lines = ["-" * 70 + "\n", "State after executing cycle: " + str(cycle) + "\n"]
        lines.append("IF.PC: " + str(state.IF.PC) + "\n")
        lines.append("IF.nop: " + str(state.IF.nop) + "\n")
        with open(self.opFilePath, "w" if cycle == 0 else "a") as wf:
            wf.writelines(lines)


class FiveStageCore(Core):
    def __init__(self, ioDir, imem, dmem):
        super(FiveStageCore, self).__init__(ioDir + os.sep + "FS_", imem, dmem)
        self.opFilePath = join_io(ioDir, "StateResult_FS.txt")

    def step(self):
        outcome = five_stage_transition(self.state, self.myRF.Registers, self.ext_imem.IMem, self.ext_dmem.DMem)
        self.commit_outcome(outcome)

    def printState(self, state, cycle):
        def bool_bit(value):
            return "1" if value else "0"

        ex_instr = bits(state.EX.instr, 32) if state.EX.instr else ""
        ex_six_zero = bool(state.EX.instr) and (state.EX.nop or not state.EX.wrt_enable)
        ex_wrt_addr = "000000" if ex_six_zero else bits(state.EX.Wrt_reg_addr, 5)
        mem_wrt_addr = "000000" if (not state.MEM.nop and not state.MEM.wrt_enable) else bits(state.MEM.Wrt_reg_addr, 5)
        wb_wrt_addr  = "000000" if (not state.WB.nop  and not state.WB.wrt_enable)  else bits(state.WB.Wrt_reg_addr, 5)
        lines = ["-" * 70 + "\n", "State after executing cycle: " + str(cycle) + "\n"]
        lines.append("IF.nop: " + str(state.IF.nop) + "\n")
        lines.append("IF.PC: " + str(state.IF.PC) + "\n")
        lines.append("ID.nop: " + str(state.ID.nop) + "\n")
        lines.append("ID.Instr: " + bits(state.ID.Instr, 32) + "\n")
        lines.append("EX.nop: " + str(state.EX.nop) + "\n")
        lines.append("EX.instr: " + ex_instr + "\n")
        lines.append("EX.Read_data1: " + bits(state.EX.Read_data1, 32) + "\n")
        lines.append("EX.Read_data2: " + bits(state.EX.Read_data2, 32) + "\n")
        lines.append("EX.Imm: " + (state.EX.Imm_bits if state.EX.Imm_bits else bits(state.EX.Imm, 32)) + "\n")
        lines.append("EX.Rs: " + bits(state.EX.Rs, 5) + "\n")
        lines.append("EX.Rt: " + bits(state.EX.Rt, 5) + "\n")
        lines.append("EX.Wrt_reg_addr: " + ex_wrt_addr + "\n")
        lines.append("EX.is_I_type: " + bool_bit(state.EX.is_I_type) + "\n")
        lines.append("EX.rd_mem: " + bool_bit(state.EX.rd_mem) + "\n")
        lines.append("EX.wrt_mem: " + bool_bit(state.EX.wrt_mem) + "\n")
        lines.append("EX.alu_op: " + str(state.EX.alu_op) + "\n")
        lines.append("EX.wrt_enable: " + bool_bit(state.EX.wrt_enable) + "\n")
        lines.append("MEM.nop: " + str(state.MEM.nop) + "\n")
        lines.append("MEM.ALUresult: " + bits(state.MEM.ALUresult, 32) + "\n")
        lines.append("MEM.Store_data: " + bits(state.MEM.Store_data, 32) + "\n")
        lines.append("MEM.Rs: " + bits(state.MEM.Rs, 5) + "\n")
        lines.append("MEM.Rt: " + bits(state.MEM.Rt, 5) + "\n")
        lines.append("MEM.Wrt_reg_addr: " + mem_wrt_addr + "\n")
        lines.append("MEM.rd_mem: " + bool_bit(state.MEM.rd_mem) + "\n")
        lines.append("MEM.wrt_mem: " + bool_bit(state.MEM.wrt_mem) + "\n")
        lines.append("MEM.wrt_enable: " + bool_bit(state.MEM.wrt_enable) + "\n")
        lines.append("WB.nop: " + str(state.WB.nop) + "\n")
        lines.append("WB.Wrt_data: " + bits(state.WB.Wrt_data, 32) + "\n")
        lines.append("WB.Rs: " + bits(state.WB.Rs, 5) + "\n")
        lines.append("WB.Rt: " + bits(state.WB.Rt, 5) + "\n")
        lines.append("WB.Wrt_reg_addr: " + wb_wrt_addr + "\n")
        lines.append("WB.wrt_enable: " + bool_bit(state.WB.wrt_enable) + "\n")

        with open(self.opFilePath, "w" if cycle == 0 else "a") as wf:
            wf.writelines(lines)


def write_performance(io_dir, ss_core, fs_core):
    content = (
        "Performance of Single Stage:\n"
        f"#Cycles -> {ss_core.cycle}\n"
        f"#Instructions -> {ss_core.instructions_executed}\n"
        f"CPI -> {ss_core.cycle / ss_core.instructions_executed}\n"
        f"IPC -> {ss_core.instructions_executed / ss_core.cycle}\n\n"
        "Performance of Five Stage:\n"
        f"#Cycles -> {fs_core.cycle}\n"
        f"#Instructions -> {fs_core.instructions_executed}\n"
        f"CPI -> {fs_core.cycle / fs_core.instructions_executed}\n"
        f"IPC -> {fs_core.instructions_executed / fs_core.cycle}"
    )
    with open(join_io(io_dir, "PerformanceMetrics.txt"), "w") as fh:
        fh.write(content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RV32I processor")
    parser.add_argument("--iodir", default="", type=str, help="Directory containing the input files.")
    args = parser.parse_args()

    ioDir = os.path.abspath(args.iodir)
    print("IO Directory:", ioDir)

    imem = InsMem("Imem", ioDir)
    dmem_ss = DataMem("SS", ioDir)
    dmem_fs = DataMem("FS", ioDir)

    ssCore = SingleStageCore(ioDir, imem, dmem_ss)
    fsCore = FiveStageCore(ioDir, imem, dmem_fs)

    while True:
        if not ssCore.halted:
            ssCore.step()

        if not fsCore.halted:
            fsCore.step()

        if ssCore.halted and fsCore.halted:
            break

    dmem_ss.outputDataMem()
    dmem_fs.outputDataMem()
    write_performance(ioDir, ssCore, fsCore)
